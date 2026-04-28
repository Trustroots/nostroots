package main

import (
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
			ID:       userID,
			Username: "alice",
			Public:   true,
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
	if event.Content != "Can host one person." {
		t.Fatalf("content = %q", event.Content)
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
	ok, err := event.CheckSignature()
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
