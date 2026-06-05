package relay

import (
	"testing"

	"github.com/nbd-wtf/go-nostr"
)

func TestTrustrootsUsernameFromTrustrootsProfileEvent(t *testing.T) {
	username, ok := TrustrootsUsernameFromEvent(nostr.Event{
		Kind: TrustrootsProfileKind,
		Tags: nostr.Tags{
			{"L", TrustrootsUsernameLabelNamespace},
			{"l", "Alice", TrustrootsUsernameLabelNamespace},
		},
	})
	if !ok || username != "alice" {
		t.Fatalf("expected alice, got %q ok=%v", username, ok)
	}
}

func TestTrustrootsUsernameFromKindZero(t *testing.T) {
	username, ok := TrustrootsUsernameFromEvent(nostr.Event{
		Kind:    0,
		Content: `{"trustrootsUsername":"Alice"}`,
	})
	if !ok || username != "alice" {
		t.Fatalf("expected alice, got %q ok=%v", username, ok)
	}
}

func TestTrustrootsUsernameFromKindZeroNIP05(t *testing.T) {
	username, ok := TrustrootsUsernameFromEvent(nostr.Event{
		Kind:    0,
		Content: `{"nip05":"alice@trustroots.org"}`,
	})
	if !ok || username != "alice" {
		t.Fatalf("expected alice, got %q ok=%v", username, ok)
	}
}
