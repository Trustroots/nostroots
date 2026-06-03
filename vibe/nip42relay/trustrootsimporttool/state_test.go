package main

import "testing"

func TestStaleEntries(t *testing.T) {
	previous := State{Offers: map[string]StateEntry{
		"keep":   {EventID: "1"},
		"delete": {EventID: "2"},
	}}
	current := State{Offers: map[string]StateEntry{
		"keep": {EventID: "3"},
	}}

	stale := staleEntries(previous, current)
	if len(stale) != 1 {
		t.Fatalf("stale count = %d", len(stale))
	}
	if stale["delete"].EventID != "2" {
		t.Fatalf("stale entry = %#v", stale["delete"])
	}
}
