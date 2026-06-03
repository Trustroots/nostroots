package auth

import (
	"errors"
	"testing"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

func TestVerify(t *testing.T) {
	privateKey := nostr.GeneratePrivateKey()
	relayURL := "ws://localhost:8042"
	challenge := "challenge-123"
	now := time.Unix(1700000000, 0)

	event := signedAuthEvent(t, privateKey, relayURL, challenge, now)
	pubkey, err := Verify(event, challenge, relayURL, time.Minute, now)
	if err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
	if pubkey != event.PubKey {
		t.Fatalf("expected pubkey %s, got %s", event.PubKey, pubkey)
	}
}

func TestVerifyFailures(t *testing.T) {
	privateKey := nostr.GeneratePrivateKey()
	relayURL := "ws://localhost:8042"
	challenge := "challenge-123"
	now := time.Unix(1700000000, 0)

	tests := []struct {
		name string
		edit func(*nostr.Event)
		want error
	}{
		{
			name: "wrong kind",
			edit: func(e *nostr.Event) {
				e.Kind = 1
				mustSign(t, e, privateKey)
			},
			want: ErrWrongKind,
		},
		{
			name: "wrong challenge",
			edit: func(e *nostr.Event) {
				e.Tags = nostr.Tags{{"challenge", "wrong"}, {"relay", relayURL}}
				mustSign(t, e, privateKey)
			},
			want: ErrWrongChallenge,
		},
		{
			name: "wrong relay",
			edit: func(e *nostr.Event) {
				e.Tags = nostr.Tags{{"challenge", challenge}, {"relay", "ws://wrong.example"}}
				mustSign(t, e, privateKey)
			},
			want: ErrWrongRelay,
		},
		{
			name: "stale",
			edit: func(e *nostr.Event) {
				e.CreatedAt = nostr.Timestamp(now.Add(-2 * time.Hour).Unix())
				mustSign(t, e, privateKey)
			},
			want: ErrStaleEvent,
		},
		{
			name: "bad signature",
			edit: func(e *nostr.Event) {
				e.Content = "tampered"
			},
			want: ErrBadSignature,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := signedAuthEvent(t, privateKey, relayURL, challenge, now)
			tt.edit(&event)
			_, err := Verify(event, challenge, relayURL, time.Minute, now)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func signedAuthEvent(t *testing.T, privateKey, relayURL, challenge string, createdAt time.Time) nostr.Event {
	t.Helper()
	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      EventKind,
		Tags:      nostr.Tags{{"challenge", challenge}, {"relay", relayURL}},
		Content:   "",
	}
	mustSign(t, &event, privateKey)
	return event
}

func mustSign(t *testing.T, event *nostr.Event, privateKey string) {
	t.Helper()
	if err := event.Sign(privateKey); err != nil {
		t.Fatalf("failed to sign event: %v", err)
	}
}
