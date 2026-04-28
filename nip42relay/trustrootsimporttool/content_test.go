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
	if got := cleanContent(long); len([]rune(got)) != maxContentLength {
		t.Fatalf("content length = %d", len([]rune(got)))
	}
}

func TestIsEligibleHost(t *testing.T) {
	user := User{
		ID:       primitive.NewObjectID(),
		Username: "alice",
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
}
