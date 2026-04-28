package relay

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nbd-wtf/go-nostr"
)

type Upstream struct {
	URL    string
	Lookup time.Duration
}

func (u Upstream) Dial(ctx context.Context) (*websocket.Conn, error) {
	dialer := websocket.DefaultDialer
	conn, _, err := dialer.DialContext(ctx, u.URL, nil)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

func (u Upstream) FindTrustrootsUsername(ctx context.Context, pubkey string) (string, error) {
	timeout := u.Lookup
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	conn, err := u.Dial(ctx)
	if err != nil {
		return "", err
	}
	defer conn.Close()

	subID := "nip42relay-profile"
	req := []any{
		"REQ",
		subID,
		map[string]any{
			"kinds":   []int{TrustrootsProfileKind, 0},
			"authors": []string{pubkey},
			"limit":   10,
		},
	}
	if err := conn.WriteJSON(req); err != nil {
		return "", err
	}
	_ = conn.SetReadDeadline(time.Now().Add(timeout))

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return "", err
		}
		var raw []json.RawMessage
		if err := json.Unmarshal(message, &raw); err != nil || len(raw) == 0 {
			continue
		}
		var typ string
		if err := json.Unmarshal(raw[0], &typ); err != nil {
			continue
		}
		switch typ {
		case "EVENT":
			if len(raw) < 3 {
				continue
			}
			var id string
			if err := json.Unmarshal(raw[1], &id); err != nil || id != subID {
				continue
			}
			var event nostr.Event
			if err := json.Unmarshal(raw[2], &event); err != nil {
				continue
			}
			if username, ok := TrustrootsUsernameFromEvent(event); ok {
				_ = conn.WriteJSON([]any{"CLOSE", subID})
				return username, nil
			}
		case "EOSE":
			return "", fmt.Errorf("no Trustroots username profile event found")
		case "CLOSED":
			return "", fmt.Errorf("upstream closed profile subscription")
		}
	}
}
