package relay

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nbd-wtf/go-nostr"
	"github.com/trustroots/nostroots/nip42relay/internal/auth"
	"github.com/trustroots/nostroots/nip42relay/internal/nip05"
	"github.com/trustroots/nostroots/nip42relay/internal/store"
)

type Server struct {
	PublicRelayURL  string
	Upstream        Upstream
	Cache           *store.Cache
	NIP05           nip05.Client
	AuthCacheTTL    time.Duration
	AuthEventMaxAge time.Duration
	Upgrader        websocket.Upgrader
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		s.health(w, r)
		return
	}
	if r.Header.Get("Accept") == "application/nostr+json" {
		s.nip11(w)
		return
	}
	if websocket.IsWebSocketUpgrade(r) {
		s.websocket(w, r)
		return
	}
	http.NotFound(w, r)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), time.Second)
	defer cancel()
	cacheOK := s.Cache == nil || s.Cache.Ping(ctx) == nil
	upstreamOK := false
	if conn, err := s.Upstream.Dial(ctx); err == nil {
		upstreamOK = true
		_ = conn.Close()
	}
	status := http.StatusOK
	if !cacheOK || !upstreamOK {
		status = http.StatusServiceUnavailable
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]bool{
		"cache":    cacheOK,
		"upstream": upstreamOK,
	})
}

func (s *Server) nip11(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/nostr+json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"name":           "nip42relay",
		"description":    "NIP-42 authenticated Trustroots NIP-05 relay gate",
		"supported_nips": []int{1, 5, 11, 42},
		"limitation": map[string]any{
			"auth_required": true,
		},
	})
}

func (s *Server) websocket(w http.ResponseWriter, r *http.Request) {
	upgrader := s.Upgrader
	if upgrader.CheckOrigin == nil {
		upgrader.CheckOrigin = func(*http.Request) bool { return true }
	}
	client, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer client.Close()

	challenge, err := auth.NewChallenge()
	if err != nil {
		log.Printf("failed to create auth challenge: %v", err)
		return
	}
	if err := client.WriteJSON([]any{"AUTH", challenge}); err != nil {
		return
	}

	var (
		upstream *websocket.Conn
		pubkey   string
		outMu    sync.Mutex
	)
	defer func() {
		if upstream != nil {
			_ = upstream.Close()
		}
	}()

	writeClient := func(v any) bool {
		outMu.Lock()
		defer outMu.Unlock()
		return client.WriteJSON(v) == nil
	}

	for {
		_, message, err := client.ReadMessage()
		if err != nil {
			return
		}
		typ, err := MessageType(message)
		if err != nil {
			if !writeClient([]any{"NOTICE", "invalid: malformed Nostr message"}) {
				return
			}
			continue
		}

		if pubkey == "" {
			if typ == "AUTH" {
				authedPubkey, eventID, err := s.authenticate(r.Context(), challenge, message)
				if err != nil {
					if !writeClient([]any{"OK", eventID, false, "restricted: " + err.Error()}) {
						return
					}
					continue
				}
				conn, err := s.Upstream.Dial(r.Context())
				if err != nil {
					if !writeClient([]any{"OK", eventID, false, "error: upstream unavailable"}) {
						return
					}
					continue
				}
				upstream = conn
				pubkey = authedPubkey
				if !writeClient([]any{"OK", eventID, true, ""}) {
					return
				}
				go pipeUpstreamToClient(upstream, writeClient)
				continue
			}
			rejectUnauthenticated(writeClient, typ, message)
			continue
		}

		if typ == "EVENT" {
			eventPubkey, err := PubkeyFromEventMessage(message)
			if err != nil || eventPubkey != pubkey {
				if !writeClient([]any{"OK", EventIDFromMessage(message), false, "restricted: authenticated pubkey does not match event pubkey"}) {
					return
				}
				continue
			}
		}
		if upstream == nil || upstream.WriteMessage(websocket.TextMessage, message) != nil {
			return
		}
	}
}

func (s *Server) authenticate(ctx context.Context, challenge string, message []byte) (string, string, error) {
	var raw []json.RawMessage
	if err := json.Unmarshal(message, &raw); err != nil || len(raw) < 2 {
		return "", "", err
	}
	var event nostr.Event
	if err := json.Unmarshal(raw[1], &event); err != nil {
		return "", "", err
	}
	pubkey, err := auth.Verify(event, challenge, s.PublicRelayURL, s.AuthEventMaxAge, time.Now())
	if err != nil {
		return "", event.ID, err
	}

	now := time.Now()
	if s.Cache != nil {
		if _, ok, err := s.Cache.GetValid(ctx, pubkey, now); err != nil {
			return "", event.ID, err
		} else if ok {
			return pubkey, event.ID, nil
		}
	}

	username, err := s.Upstream.FindTrustrootsUsername(ctx, pubkey)
	if err != nil {
		return "", event.ID, err
	}
	if err := s.NIP05.Verify(ctx, username, pubkey); err != nil {
		return "", event.ID, err
	}
	if s.Cache != nil {
		if err := s.Cache.Put(ctx, pubkey, username, now, now.Add(s.AuthCacheTTL)); err != nil {
			return "", event.ID, err
		}
	}
	return pubkey, event.ID, nil
}

func rejectUnauthenticated(write func(any) bool, typ string, message []byte) {
	switch typ {
	case "REQ":
		var raw []json.RawMessage
		if err := json.Unmarshal(message, &raw); err == nil && len(raw) >= 2 {
			var subID string
			_ = json.Unmarshal(raw[1], &subID)
			write([]any{"CLOSED", subID, "auth-required: NIP-42 authentication required"})
			return
		}
		write([]any{"NOTICE", "auth-required: NIP-42 authentication required"})
	case "EVENT":
		write([]any{"OK", EventIDFromMessage(message), false, "auth-required: NIP-42 authentication required"})
	default:
		write([]any{"NOTICE", "auth-required: NIP-42 authentication required"})
	}
}

func pipeUpstreamToClient(upstream *websocket.Conn, write func(any) bool) {
	for {
		_, message, err := upstream.ReadMessage()
		if err != nil {
			return
		}
		var v any
		if err := json.Unmarshal(message, &v); err != nil {
			continue
		}
		if !write(v) {
			return
		}
	}
}
