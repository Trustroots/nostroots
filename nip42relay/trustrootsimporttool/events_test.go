package main

import (
	"strings"
	"testing"
	"time"

	"github.com/nbd-wtf/go-nostr"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const testPrivateKey = "0000000000000000000000000000000000000000000000000000000000000001"

func TestEventForHost(t *testing.T) {
	offerID := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	created := time.Unix(1700000000, 0)
	updated := time.Unix(1700000100, 0)
	event, err := eventForHost(HostRecord{
		Offer: Offer{
			ID:            offerID,
			Type:          "host",
			Status:        "yes",
			Description:   "<p>Can host one person.</p>",
			LocationFuzzy: []float64{52.5, 13.4},
			CreatedAt:     created,
			Updated:       updated,
			UserID:        userID,
		},
		User: User{
			ID:        userID,
			Username:  "alice",
			NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
			Public:    true,
		},
		Circles: []string{"hitchhikers"},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if event.Kind != mapNoteRepostKind {
		t.Fatalf("kind = %d", event.Kind)
	}
	if event.CreatedAt != nostr.Timestamp(updated.Unix()) {
		t.Fatalf("created_at = %d", event.CreatedAt)
	}
	if event.Tags.GetD() != dTagForOffer(offerID.Hex()) {
		t.Fatalf("d tag = %q", event.Tags.GetD())
	}
	if event.Content == "Can host one person." {
		t.Fatalf("content was not enriched: %q", event.Content)
	}
	if !strings.Contains(event.Content, "Can host one person.") {
		t.Fatalf("missing description in content: %q", event.Content)
	}
	if !strings.Contains(event.Content, "https://www.trustroots.org/profile/alice") {
		t.Fatalf("missing profile link in content: %q", event.Content)
	}
	if !strings.Contains(event.Content, "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj") {
		t.Fatalf("missing npub in content: %q", event.Content)
	}
	if tag := event.Tags.GetFirst([]string{"r", "https://www.trustroots.org/profile/alice"}); tag == nil {
		t.Fatalf("missing r profile tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"trustroots", "alice"}); tag == nil {
		t.Fatalf("missing trustroots tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"t", "hostingoffers"}); tag == nil {
		t.Fatalf("missing t hostingoffers tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"t", "hitchhikers"}); tag == nil {
		t.Fatalf("missing t circle tag: %#v", event.Tags)
	}
	expectedPubKey, ok := decodeNpubToHex("npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj")
	if !ok {
		t.Fatal("failed to decode expected test npub")
	}
	if tag := event.Tags.GetFirst([]string{"p", expectedPubKey}); tag == nil {
		t.Fatalf("missing p tag for decoded npub: %#v", event.Tags)
	}
	openLocationCode := ""
	for _, tag := range event.Tags {
		if len(tag) >= 3 && tag[0] == "l" && tag[2] == "open-location-code" {
			openLocationCode = tag[1]
			break
		}
	}
	if openLocationCode == "" {
		t.Fatalf("missing open-location-code tag: %#v", event.Tags)
	}
	if openLocationCode != "9F4M0000+" {
		t.Fatalf("open-location-code = %q", openLocationCode)
	}
	ok, err = event.CheckSignature()
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("signature did not verify")
	}
}

func TestDeletionEvent(t *testing.T) {
	event, err := deletionEvent(StateEntry{
		EventID: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		DTag:    "trustroots:offer:abc",
		PubKey:  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	}, testPrivateKey, time.Unix(1700000200, 0))
	if err != nil {
		t.Fatal(err)
	}
	if event.Kind != nostr.KindDeletion {
		t.Fatalf("kind = %d", event.Kind)
	}
	if tag := event.Tags.GetFirst([]string{"e", ""}); tag == nil || (*tag)[1] == "" {
		t.Fatalf("missing e tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"a", ""}); tag == nil || (*tag)[1] == "" {
		t.Fatalf("missing a tag: %#v", event.Tags)
	}
}
