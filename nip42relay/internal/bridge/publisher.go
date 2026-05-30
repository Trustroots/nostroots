package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nbd-wtf/go-nostr"
	"github.com/trustroots/nostroots/nip42relay/internal/auth"
)

type NostrPublisher struct {
	targetRelayURL string
	authRelayURL   string
	secretHex      string
	dialer         *websocket.Dialer
}

func NewNostrPublisher(targetRelayURL, authRelayURL, secretHex string) *NostrPublisher {
	return &NostrPublisher{
		targetRelayURL: targetRelayURL,
		authRelayURL:   authRelayURL,
		secretHex:      secretHex,
		dialer: &websocket.Dialer{
			Proxy:            http.ProxyFromEnvironment,
			HandshakeTimeout: 10 * time.Second,
		},
	}
}

func (p *NostrPublisher) AuthProbe(ctx context.Context) error {
	conn, err := p.connectAndAuthenticate(ctx)
	if err != nil {
		return err
	}
	_ = conn.Close()
	return nil
}

func (p *NostrPublisher) Publish(ctx context.Context, content string) error {
	conn, err := p.connectAndAuthenticate(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	event := buildChannelEvent(strings.TrimSpace(content))
	if event.Content == "" {
		return fmt.Errorf("refusing to publish empty content")
	}
	if err := event.Sign(p.secretHex); err != nil {
		return fmt.Errorf("sign bridge event: %w", err)
	}

	if err := conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return err
	}
	if err := conn.WriteJSON([]any{"EVENT", event}); err != nil {
		return err
	}

	accepted, reason, err := waitForOK(ctx, conn, event.ID)
	if err != nil {
		return err
	}
	if !accepted {
		return fmt.Errorf("relay rejected bridge event: %s", reason)
	}
	return nil
}

func (p *NostrPublisher) connectAndAuthenticate(ctx context.Context) (*websocket.Conn, error) {
	conn, _, err := p.dialer.DialContext(ctx, p.targetRelayURL, nil)
	if err != nil {
		return nil, fmt.Errorf("connect relay: %w", err)
	}

	challenge, err := waitForAuthChallenge(ctx, conn)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}

	authEvent := buildAuthEvent(challenge, p.authRelayURL)
	if err := authEvent.Sign(p.secretHex); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("sign auth event: %w", err)
	}

	if err := conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := conn.WriteJSON([]any{"AUTH", authEvent}); err != nil {
		_ = conn.Close()
		return nil, err
	}

	accepted, reason, err := waitForOK(ctx, conn, authEvent.ID)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	if !accepted {
		_ = conn.Close()
		return nil, fmt.Errorf("relay rejected auth event: %s", reason)
	}
	return conn, nil
}

func waitForAuthChallenge(ctx context.Context, conn *websocket.Conn) (string, error) {
	for {
		if deadline, ok := ctx.Deadline(); ok {
			_ = conn.SetReadDeadline(deadline)
		} else {
			_ = conn.SetReadDeadline(time.Now().Add(15 * time.Second))
		}
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return "", fmt.Errorf("read auth challenge: %w", err)
		}
		var raw []json.RawMessage
		if err := json.Unmarshal(msg, &raw); err != nil || len(raw) < 2 {
			continue
		}
		var typ string
		if err := json.Unmarshal(raw[0], &typ); err != nil {
			continue
		}
		if typ != "AUTH" {
			continue
		}
		var challenge string
		if err := json.Unmarshal(raw[1], &challenge); err != nil {
			continue
		}
		if strings.TrimSpace(challenge) == "" {
			continue
		}
		return challenge, nil
	}
}

func waitForOK(ctx context.Context, conn *websocket.Conn, expectedID string) (accepted bool, reason string, err error) {
	for {
		if deadline, ok := ctx.Deadline(); ok {
			_ = conn.SetReadDeadline(deadline)
		} else {
			_ = conn.SetReadDeadline(time.Now().Add(20 * time.Second))
		}
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return false, "", fmt.Errorf("read relay response: %w", err)
		}
		var raw []json.RawMessage
		if err := json.Unmarshal(msg, &raw); err != nil || len(raw) < 4 {
			continue
		}
		var typ string
		if err := json.Unmarshal(raw[0], &typ); err != nil || typ != "OK" {
			continue
		}
		var id string
		if err := json.Unmarshal(raw[1], &id); err != nil || id != expectedID {
			continue
		}
		if err := json.Unmarshal(raw[2], &accepted); err != nil {
			return false, "", fmt.Errorf("invalid relay OK accepted flag")
		}
		_ = json.Unmarshal(raw[3], &reason)
		return accepted, reason, nil
	}
}

func buildAuthEvent(challenge, relayURL string) nostr.Event {
	return nostr.Event{
		CreatedAt: nostr.Now(),
		Kind:      auth.EventKind,
		Tags: nostr.Tags{
			{"relay", relayURL},
			{"challenge", challenge},
		},
		Content: "",
	}
}

func buildChannelEvent(content string) nostr.Event {
	return nostr.Event{
		CreatedAt: nostr.Now(),
		Kind:      30397,
		Tags: nostr.Tags{
			{"L", "trustroots-circle"},
			{"l", TargetChannelSlug, "trustroots-circle"},
		},
		Content: content,
	}
}
