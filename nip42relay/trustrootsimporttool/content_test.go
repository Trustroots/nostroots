package main

import (
	"strings"
	"testing"
	"time"

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
	if !strings.Contains(got, "#hosting") {
		t.Fatalf("missing #hosting in content: %q", got)
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
		ID:        primitive.NewObjectID(),
		Username:  "alice",
		NostrNpub: "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
		Public:    true,
		Roles:     []string{"user"},
	}
	offer := Offer{
		ID:            primitive.NewObjectID(),
		Type:          "host",
		Status:        "yes",
		MaxGuests:     1,
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

	offer.MaxGuests = 0
	if isEligibleHost(offer, user) {
		t.Fatal("maxGuests 0 should not be eligible")
	}
	offer.MaxGuests = 1

	past := time.Now().Add(-24 * time.Hour)
	offer.ValidUntil = &past
	if isEligibleHost(offer, user) {
		t.Fatal("expired validUntil should not be eligible")
	}
	offer.ValidUntil = nil

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

func TestIsEligibleUserEmailAndRoles(t *testing.T) {
	confirmed := true
	user := User{
		ID:             primitive.NewObjectID(),
		Username:       "alice",
		NostrNpub:      "npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj",
		Public:         true,
		EmailConfirmed: &confirmed,
		Roles:          []string{"user"},
	}
	if !isEligibleUser(user) {
		t.Fatal("expected user to be eligible")
	}

	user.EmailUnconfirmed = true
	if isEligibleUser(user) {
		t.Fatal("email-unconfirmed user should not be eligible")
	}
	user.EmailUnconfirmed = false

	unconfirmed := false
	user.EmailConfirmed = &unconfirmed
	if isEligibleUser(user) {
		t.Fatal("emailConfirmed=false user should not be eligible")
	}

	user.EmailConfirmed = &confirmed
	user.Roles = []string{"user", "shadowbanned-temp"}
	if isEligibleUser(user) {
		t.Fatal("shadow-ban role should not be eligible")
	}
}

func TestIsPositiveExperience(t *testing.T) {
	if !isPositiveExperience(Experience{Public: true, Recommend: recommendField(recommendTruthFromString("yes"))}) {
		t.Fatal("public + recommend=yes should export")
	}
	if !isPositiveExperience(Experience{Public: true, Recommend: true}) {
		t.Fatal("public + recommend bool true should export")
	}
	if isPositiveExperience(Experience{Public: true, Recommend: recommendField(recommendTruthFromString("no"))}) {
		t.Fatal("recommend=no should not export")
	}
	if isPositiveExperience(Experience{Public: true, Recommend: recommendField(recommendTruthFromString("unknown"))}) {
		t.Fatal("recommend=unknown should not export")
	}
	if isPositiveExperience(Experience{Public: false, Recommend: recommendField(recommendTruthFromString("yes"))}) {
		t.Fatal("non-public experience should not export")
	}
}

func TestRecommendTruthFromString(t *testing.T) {
	if !recommendTruthFromString("yes") || recommendTruthFromString("no") {
		t.Fatal("string yes/no")
	}
}
