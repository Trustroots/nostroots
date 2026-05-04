package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/nbd-wtf/go-nostr"
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
	event, err := eventForProfileClaim(user, nil, testPrivateKey)
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
	var meta map[string]string
	if err := json.Unmarshal([]byte(event.Content), &meta); err != nil {
		t.Fatal(err)
	}
	if meta["picture"] != "https://example.com/a.jpg" {
		t.Fatalf("picture = %q", meta["picture"])
	}
}

func TestEventForProfileClaim_includesNormalizedCircleTags(t *testing.T) {
	user := User{
		Username:  "nostroots",
		NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
	}
	event, err := eventForProfileClaim(user, []string{"hackers", "Hackers", "acme-campers"}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if tag := event.Tags.GetFirst([]string{"l", "hackers", trustrootsCircleLabelNamespace}); tag == nil {
		t.Fatalf("missing hackers circle l tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"t", "hackers"}); tag == nil {
		t.Fatalf("missing hackers t tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"l", "acmecampers", trustrootsCircleLabelNamespace}); tag == nil {
		t.Fatalf("missing acmecampers circle l tag: %#v", event.Tags)
	}
}

func TestProfileClaimPictureURL_localUpload(t *testing.T) {
	oid := primitive.NewObjectID()
	updated := time.Date(2024, 3, 1, 12, 0, 0, 0, time.UTC)
	u := User{
		ID:             oid,
		AvatarSource:   "local",
		AvatarUploaded: true,
		Updated:        updated,
	}
	got := profileClaimPictureURL(u)
	want := fmt.Sprintf("https://www.trustroots.org/uploads-profile/%s/avatar/256.jpg?%d", oid.Hex(), updated.UnixMilli())
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestProfileClaimPictureURL_gravatar(t *testing.T) {
	u := User{
		ID:           primitive.NewObjectID(),
		AvatarSource: "gravatar",
		EmailHash:    "abc",
	}
	got := profileClaimPictureURL(u)
	if got != "https://www.gravatar.com/avatar/abc?s=256&d=identicon" {
		t.Fatalf("got %q", got)
	}
}

func TestEventForProfileClaim_usesTrustrootsLocalUploadPicture(t *testing.T) {
	oid := primitive.NewObjectID()
	updated := time.Date(2024, 3, 1, 12, 0, 0, 0, time.UTC)
	user := User{
		ID:             oid,
		Username:       "Nostroots",
		NostrNpub:      "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
		AvatarSource:   "local",
		AvatarUploaded: true,
		Updated:        updated,
	}
	event, err := eventForProfileClaim(user, nil, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	var meta map[string]string
	if err := json.Unmarshal([]byte(event.Content), &meta); err != nil {
		t.Fatal(err)
	}
	wantPic := fmt.Sprintf("https://www.trustroots.org/uploads-profile/%s/avatar/256.jpg?%d", oid.Hex(), updated.UnixMilli())
	if meta["picture"] != wantPic {
		t.Fatalf("picture = %q want %q", meta["picture"], wantPic)
	}
	if tag := event.Tags.GetFirst([]string{"source", "trustroots-import"}); tag == nil {
		t.Fatalf("missing source tag: %#v", event.Tags)
	}
	if tag := event.Tags.GetFirst([]string{"l", "nostroots", TrustrootsUsernameLabelNamespace}); tag == nil {
		t.Fatalf("missing username label tag: %#v", event.Tags)
	}
}


func countPTags(tags nostr.Tags) int {
	n := 0
	for _, row := range tags {
		if len(row) >= 2 && row[0] == "p" {
			n++
		}
	}
	return n
}

func hasUsernameLabelPair(tags nostr.Tags, usernameLower string) bool {
	for i := 0; i+1 < len(tags); i++ {
		if len(tags[i]) >= 2 && tags[i][0] == "L" && tags[i][1] == TrustrootsUsernameLabelNamespace {
			if len(tags[i+1]) >= 3 && tags[i+1][0] == "l" && tags[i+1][1] == usernameLower {
				return true
			}
		}
	}
	return false
}

func TestEventForRelationshipClaim_bothNpubs(t *testing.T) {
	// Two valid npubs (here the same fixture npub twice) → two `p` tags, no username labels.
	idA := primitive.NewObjectID()
	idB := primitive.NewObjectID()
	cid := primitive.NewObjectID()
	np := "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj"
	ev, err := eventForRelationshipClaim(ContactRecord{
		Contact: Contact{ID: cid, UserFrom: idA, UserTo: idB},
		User:    User{ID: idA, Username: "alice", NostrNpub: np, Public: true},
		Other:   User{ID: idB, Username: "bob", NostrNpub: np, Public: true},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if ev.Kind != relationClaimKind {
		t.Fatalf("kind = %d", ev.Kind)
	}
	if countPTags(ev.Tags) != 2 {
		t.Fatalf("want 2 p tags, got %d tags=%v", countPTags(ev.Tags), ev.Tags)
	}
	if hasUsernameLabelPair(ev.Tags, "alice") || hasUsernameLabelPair(ev.Tags, "bob") {
		t.Fatal("did not expect username label pairs when both have npubs")
	}
}

func TestEventForRelationshipClaim_oneNpubUsernameLabels(t *testing.T) {
	idA := primitive.NewObjectID()
	idB := primitive.NewObjectID()
	cid := primitive.NewObjectID()
	ev, err := eventForRelationshipClaim(ContactRecord{
		Contact: Contact{ID: cid, UserFrom: idA, UserTo: idB},
		User:    User{ID: idA, Username: "alice", NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj", Public: true},
		Other:   User{ID: idB, Username: "bobnopub", NostrNpub: "", Public: true},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if countPTags(ev.Tags) != 1 {
		t.Fatalf("want 1 p tag, got %d", countPTags(ev.Tags))
	}
	if !hasUsernameLabelPair(ev.Tags, "bobnopub") {
		t.Fatalf("expected username labels for bobnopub, tags=%v", ev.Tags)
	}
}

func TestEventForRelationshipClaim_neitherNpub(t *testing.T) {
	idA := primitive.NewObjectID()
	idB := primitive.NewObjectID()
	cid := primitive.NewObjectID()
	_, err := eventForRelationshipClaim(ContactRecord{
		Contact: Contact{ID: cid, UserFrom: idA, UserTo: idB},
		User:    User{ID: idA, Username: "a", NostrNpub: "", Public: true},
		Other:   User{ID: idB, Username: "b", NostrNpub: "", Public: true},
	}, testPrivateKey)
	if err == nil {
		t.Fatal("expected error when neither side has npub")
	}
}

func TestEventForExperienceClaim_oneNpub(t *testing.T) {
	eid := primitive.NewObjectID()
	idA := primitive.NewObjectID()
	idB := primitive.NewObjectID()
	ev, err := eventForExperienceClaim(ExperienceRecord{
		Experience: Experience{ID: eid, UserFrom: idA, UserTo: idB, Public: true, Recommend: true},
		Author:     User{ID: idA, Username: "author", NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj", Public: true},
		Target:     User{ID: idB, Username: "guest", NostrNpub: "", Public: true},
	}, testPrivateKey)
	if err != nil {
		t.Fatal(err)
	}
	if ev.Kind != experienceClaimKind {
		t.Fatalf("kind = %d", ev.Kind)
	}
	if countPTags(ev.Tags) != 1 {
		t.Fatalf("want 1 p tag, got %d", countPTags(ev.Tags))
	}
	if !hasUsernameLabelPair(ev.Tags, "guest") {
		t.Fatalf("expected username labels for guest, tags=%v", ev.Tags)
	}
}
