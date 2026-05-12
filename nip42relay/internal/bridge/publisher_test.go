package bridge

import (
	"testing"

	"github.com/trustroots/nostroots/nip42relay/internal/auth"
)

func TestBuildAuthEvent(t *testing.T) {
	e := buildAuthEvent("challenge-123", "ws://localhost:8042")
	if e.Kind != auth.EventKind {
		t.Fatalf("kind=%d want=%d", e.Kind, auth.EventKind)
	}
	relayTag := e.Tags.GetFirst([]string{"relay"})
	if relayTag == nil || relayTag.Value() != "ws://localhost:8042" {
		t.Fatalf("relay tag mismatch")
	}
	challengeTag := e.Tags.GetFirst([]string{"challenge"})
	if challengeTag == nil || challengeTag.Value() != "challenge-123" {
		t.Fatalf("challenge tag mismatch")
	}
}

func TestBuildChannelEvent(t *testing.T) {
	e := buildChannelEvent("hello")
	if e.Kind != 30397 {
		t.Fatalf("kind=%d want=30397", e.Kind)
	}
	if e.Content != "hello" {
		t.Fatalf("content mismatch")
	}
	if e.Tags.GetFirst([]string{"L"}) == nil || e.Tags.GetFirst([]string{"L"}).Value() != "trustroots-circle" {
		t.Fatalf("missing L tag")
	}
	lTag := e.Tags.GetFirst([]string{"l"})
	if lTag == nil || lTag.Value() != TargetChannelSlug {
		t.Fatalf("missing l tag channel slug")
	}
}
