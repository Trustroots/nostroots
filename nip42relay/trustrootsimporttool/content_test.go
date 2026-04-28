package main

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestCleanContent(t *testing.T) {
	got := cleanContent("<p>Hello&nbsp;<strong>travellers</strong></p>")
	if got != "Hello travellers" {
		t.Fatalf("cleanContent() = %q", got)
	}

	if got := cleanContent(""); got != "Trustroots host" {
		t.Fatalf("empty content fallback = %q", got)
	}

	long := strings.Repeat("a", maxContentLength+10)
	if got := cleanContent(long); len([]rune(got)) != maxContentLength+10 {
		t.Fatalf("cleaned content length = %d", len([]rune(got)))
	}
}

func TestBuildNoteContent(t *testing.T) {
	user := User{
		Username:  "alice",
		NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
	}
	got := buildNoteContent("<p>Can host one person.</p>", user)
	if !strings.Contains(got, "https://www.trustroots.org/profile/alice") {
		t.Fatalf("missing Trustroots profile link in content: %q", got)
	}
	if !strings.Contains(got, "#hostingoffers") {
		t.Fatalf("missing #hostingoffers in content: %q", got)
	}
	if !strings.Contains(got, user.NostrNpub) {
		t.Fatalf("missing npub in content: %q", got)
	}
	if len([]rune(got)) > maxContentLength {
		t.Fatalf("content length = %d", len([]rune(got)))
	}
}

func TestIsEligibleHost(t *testing.T) {
	user := User{
		ID:       primitive.NewObjectID(),
		Username: "alice",
		NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
		Public:   true,
		Roles:    []string{"user"},
	}
	offer := Offer{
		ID:            primitive.NewObjectID(),
		Type:          "host",
		Status:        "yes",
		LocationFuzzy: []float64{52.5, 13.4},
		UserID:        user.ID,
	}
	if !isEligibleHost(offer, user) {
		t.Fatal("expected public host to be eligible")
	}

	offer.ShowOnlyInMyCircles = true
	if isEligibleHost(offer, user) {
		t.Fatal("circle-limited host should not be eligible")
	}
	offer.ShowOnlyInMyCircles = false

	user.Roles = []string{"user", "suspended"}
	if isEligibleHost(offer, user) {
		t.Fatal("suspended user should not be eligible")
	}
	user.Roles = []string{"user"}

	user.NostrNpub = ""
	if isEligibleHost(offer, user) {
		t.Fatal("host without npub should not be eligible")
	}

	user.NostrNpub = "npub-not-valid"
	if isEligibleHost(offer, user) {
		t.Fatal("host with invalid npub should not be eligible")
	}
}
