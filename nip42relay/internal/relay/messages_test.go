package relay

import (
	"strings"
	"testing"

	"github.com/nbd-wtf/go-nostr"
)

func TestValidateUnauthenticatedKind0(t *testing.T) {
	privateKey := nostr.GeneratePrivateKey()
	valid := nostr.Event{
		Kind:      0,
		CreatedAt: nostr.Now(),
		Tags:      nostr.Tags{},
		Content:   `{"name":"alice"}`,
	}
	if err := valid.Sign(privateKey); err != nil {
		t.Fatalf("failed to sign event: %v", err)
	}

	if err := ValidateUnauthenticatedKind0(valid); err != nil {
		t.Fatalf("expected valid event, got error: %v", err)
	}

	nonKindZero := valid
	nonKindZero.Kind = 1
	if err := ValidateUnauthenticatedKind0(nonKindZero); err == nil {
		t.Fatalf("expected non-kind0 to fail")
	}

	badID := valid
	badID.ID = "00"
	if err := ValidateUnauthenticatedKind0(badID); err == nil || !strings.Contains(err.Error(), "event id") {
		t.Fatalf("expected id mismatch error, got: %v", err)
	}

	badSig := valid
	badSig.Sig = "00"
	if err := ValidateUnauthenticatedKind0(badSig); err == nil || !strings.Contains(err.Error(), "signature") {
		t.Fatalf("expected signature error, got: %v", err)
	}
}

func TestParseEventMessage(t *testing.T) {
	privateKey := nostr.GeneratePrivateKey()
	event := nostr.Event{
		Kind:      0,
		CreatedAt: nostr.Now(),
		Tags:      nostr.Tags{},
		Content:   "{}",
	}
	if err := event.Sign(privateKey); err != nil {
		t.Fatalf("failed to sign event: %v", err)
	}

	message := `["EVENT",` + event.String() + `]`
	parsed, err := ParseEventMessage([]byte(message))
	if err != nil {
		t.Fatalf("expected parse success, got: %v", err)
	}
	if parsed.ID != event.ID {
		t.Fatalf("expected event id %s, got %s", event.ID, parsed.ID)
	}
}
