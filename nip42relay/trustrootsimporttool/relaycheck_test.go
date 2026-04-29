package main

import "testing"

func TestHasMatchingProfileMetadata(t *testing.T) {
	user := User{Username: "Alice"}
	if !hasMatchingProfileMetadata(map[string]any{"nip05": "alice@trustroots.org"}, user) {
		t.Fatal("nip05 should match")
	}
	if !hasMatchingProfileMetadata(map[string]any{"trustrootsUsername": "alice"}, user) {
		t.Fatal("trustrootsUsername should match")
	}
	if !hasMatchingProfileMetadata(map[string]any{"name": "alice"}, user) {
		t.Fatal("name should match")
	}
	if hasMatchingProfileMetadata(map[string]any{"nip05": "alice@example.com"}, user) {
		t.Fatal("unrelated nip05 should not match")
	}
}

func TestParseCSV(t *testing.T) {
	got := parseCSV(" wss://a, ,wss://b ")
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(got))
	}
	if got[0] != "wss://a" || got[1] != "wss://b" {
		t.Fatalf("unexpected parse result: %#v", got)
	}
}
