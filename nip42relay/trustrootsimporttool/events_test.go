package main

import (
	"encoding/json"
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
			MaxGuests:     1,
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
	if !strings.Contains(event.Content, "Can host one person.") {
		t.Fatalf("missing description in content: %q", event.Content)
	}
	if strings.Contains(event.Content, "https://www.trustroots.org/profile/alice") {
		t.Fatalf("unexpected profile link in content: %q", event.Content)
	}
	if strings.Contains(event.Content, "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj") {
		t.Fatalf("unexpected npub in content: %q", event.Content)
	}
	if tag := event.Tags.GetFirst([]string{"r", "https://www.trustroots.org/profile/alice"}); tag == nil {
		t.Fatalf("missing r profile tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"trustroots", "alice"}); tag == nil {
		t.Fatalf("missing trustroots tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"claimable", "true"}); tag == nil {
		t.Fatalf("missing claimable tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"t", "hosting"}); tag == nil {
		t.Fatalf("missing t hosting tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"t", "hitchhikers"}); tag == nil {
		t.Fatalf("missing t circle tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"l", "hitchhikers", trustrootsCircleLabelNamespace}); tag == nil {
		t.Fatalf("missing trustroots-circle l tag: %#v", event.Tags)
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

func TestEventForHostMaybeStatusTag(t *testing.T) {
	offerID := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	created := time.Unix(1700000000, 0)
	updated := time.Unix(1700000100, 0)
	event, err := eventForHost(HostRecord{
		Offer: Offer{
			ID:            offerID,
			Type:          "host",
			Status:        "maybe",
			MaxGuests:     1,
			Description:   "Could maybe host",
			LocationFuzzy: []float64{52.5, 13.4},
			CreatedAt:     created,
			Updated:       updated,
			UserID:        userID,
		},
		User: User{
			ID:        userID,
			Username:  "dana",
			NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
			Public:    true,
		},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if tag := event.Tags.GetFirst([]string{"status", "maybe"}); tag == nil {
		t.Fatalf("missing status maybe tag: %#v", event.Tags)
	}
}

func TestEventForHostYesHasNoMaybeStatusTag(t *testing.T) {
	offerID := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	created := time.Unix(1700000000, 0)
	updated := time.Unix(1700000100, 0)
	event, err := eventForHost(HostRecord{
		Offer: Offer{
			ID:            offerID,
			Type:          "host",
			Status:        "yes",
			MaxGuests:     1,
			Description:   "Can host",
			LocationFuzzy: []float64{52.5, 13.4},
			CreatedAt:     created,
			Updated:       updated,
			UserID:        userID,
		},
		User: User{
			ID:        userID,
			Username:  "erin",
			NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
			Public:    true,
		},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if tag := event.Tags.GetFirst([]string{"status", "maybe"}); tag != nil {
		t.Fatalf("unexpected status maybe tag on yes offer: %#v", event.Tags)
	}
}

func TestEventForHostCircleTagStripsHyphens(t *testing.T) {
	offerID := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	created := time.Unix(1700000000, 0)
	updated := time.Unix(1700000100, 0)
	event, err := eventForHost(HostRecord{
		Offer: Offer{
			ID:            offerID,
			Type:          "host",
			Status:        "yes",
			MaxGuests:     1,
			Description:   "Hi",
			LocationFuzzy: []float64{52.5, 13.4},
			CreatedAt:     created,
			Updated:       updated,
			UserID:        userID,
		},
		User: User{
			ID:        userID,
			Username:  "carol",
			NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
			Public:    true,
		},
		Circles: []string{"beer-brewers"},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if tag := event.Tags.GetFirst([]string{"t", "beerbrewers"}); tag == nil {
		t.Fatalf("missing t circle tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"l", "beerbrewers", trustrootsCircleLabelNamespace}); tag == nil {
		t.Fatalf("missing trustroots-circle l tag: %#v", event.Tags)
	}
}

func TestEventForHostCircleTagsLowercaseAndDeduped(t *testing.T) {
	offerID := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	created := time.Unix(1700000000, 0)
	updated := time.Unix(1700000100, 0)
	event, err := eventForHost(HostRecord{
		Offer: Offer{
			ID:            offerID,
			Type:          "host",
			Status:        "yes",
			MaxGuests:     1,
			Description:   "Hi",
			LocationFuzzy: []float64{52.5, 13.4},
			CreatedAt:     created,
			Updated:       updated,
			UserID:        userID,
		},
		User: User{
			ID:        userID,
			Username:  "bob",
			NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
			Public:    true,
		},
		Circles: []string{"Musicians", "musicians", " MUSICIANS "},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	var circleLTags, circleTTags int
	for _, tag := range event.Tags {
		if len(tag) >= 3 && tag[0] == "l" && tag[2] == trustrootsCircleLabelNamespace {
			circleLTags++
			if tag[1] != "musicians" {
				t.Fatalf("circle l value = %q want musicians", tag[1])
			}
		}
		if len(tag) >= 2 && tag[0] == "t" && tag[1] == "musicians" {
			circleTTags++
		}
	}
	if circleLTags != 1 {
		t.Fatalf("want 1 trustroots-circle l tag, got %d tags=%#v", circleLTags, event.Tags)
	}
	if circleTTags != 1 {
		t.Fatalf("want 1 musicians t tag, got %d", circleTTags)
	}
}

func TestEventForCircleMetadata(t *testing.T) {
	event, err := eventForCircleMetadata(Tribe{
		ID:          primitive.NewObjectID(),
		Label:       "Hitchhikers",
		Slug:        " Hitch ",
		Public:      true,
		Description: "Get lifts and share the road.",
		Image:       true,
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if event.Kind != circleMetadataKind {
		t.Fatalf("kind = %d", event.Kind)
	}
	if event.Tags.GetD() != "hitch" {
		t.Fatalf("d tag = %q", event.Tags.GetD())
	}
	if tag := event.Tags.GetFirst([]string{"l", "hitch", trustrootsCircleLabelNamespace}); tag == nil {
		t.Fatalf("missing circle l tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"source", "trustroots-import"}); tag == nil {
		t.Fatalf("missing source tag: %#v", event.Tags)
	}
	var payload map[string]string
	if err := json.Unmarshal([]byte(event.Content), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["name"] != "Hitchhikers" {
		t.Fatalf("name = %q", payload["name"])
	}
	if payload["about"] != "Get lifts and share the road." {
		t.Fatalf("about = %q", payload["about"])
	}
	wantPic := "https://www.trustroots.org/uploads-circle/hitch/742x496.jpg"
	if payload["picture"] != wantPic {
		t.Fatalf("picture = %q want %q", payload["picture"], wantPic)
	}
	ok, err := event.CheckSignature()
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("signature did not verify")
	}
}

func TestEventForCircleMetadataHyphenSlugUsesDashlessDTagAndMongoPicturePath(t *testing.T) {
	event, err := eventForCircleMetadata(Tribe{
		ID:          primitive.NewObjectID(),
		Label:       "Beer brewers",
		Slug:        "beer-brewers",
		Public:      true,
		Description: "Brew spots",
		Image:       true,
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if event.Tags.GetD() != "beerbrewers" {
		t.Fatalf("d tag = %q want beerbrewers", event.Tags.GetD())
	}
	if tag := event.Tags.GetFirst([]string{"l", "beerbrewers", trustrootsCircleLabelNamespace}); tag == nil {
		t.Fatalf("missing circle l tag: %#v", event.Tags)
	}
	var payload map[string]string
	if err := json.Unmarshal([]byte(event.Content), &payload); err != nil {
		t.Fatal(err)
	}
	wantPic := "https://www.trustroots.org/uploads-circle/beer-brewers/742x496.jpg"
	if payload["picture"] != wantPic {
		t.Fatalf("picture = %q want %q", payload["picture"], wantPic)
	}
}

func TestEventForCircleMetadataSkipsPictureWhenNoImage(t *testing.T) {
	event, err := eventForCircleMetadata(Tribe{
		ID:          primitive.NewObjectID(),
		Label:       "Hackers",
		Slug:        "hackers",
		Public:      true,
		Description: "Code",
		Image:       false,
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]string
	if err := json.Unmarshal([]byte(event.Content), &payload); err != nil {
		t.Fatal(err)
	}
	if _, has := payload["picture"]; has {
		t.Fatalf("expected no picture field, got %#v", payload)
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
