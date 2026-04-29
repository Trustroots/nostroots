package main

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestEventForProfileClaim(t *testing.T) {
	user := User{
		ID:          primitive.NewObjectID(),
		Username:    "Alice",
		DisplayName: " Alice ",
		Description: " Hi ",
		Avatar:      "https://example.com/a.jpg",
		NostrNpub:   "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
	}
	event, err := eventForProfileClaim(user, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if event.Kind != profileClaimKind {
		t.Fatalf("kind = %d", event.Kind)
	}
	if !strings.Contains(event.Content, "alice@trustroots.org") {
		t.Fatalf("content should include nip05: %q", event.Content)
	}
	if event.Tags.GetD() != "trustroots:profile:alice" {
		t.Fatalf("d tag = %q", event.Tags.GetD())
	}
}
