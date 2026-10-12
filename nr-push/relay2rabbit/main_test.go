package main

import "testing"

func TestRedactURLHidesPassword(t *testing.T) {
	got := redactURL("amqp://user:secret@rabbit:5672/")
	want := "amqp://user:xxxxx@rabbit:5672/"
	if got != want {
		t.Fatalf("redactURL() = %q, want %q", got, want)
	}
}

func TestRedactURLUnparseable(t *testing.T) {
	if got := redactURL("::not a url"); got != "(unparseable)" {
		t.Fatalf("redactURL() = %q", got)
	}
}
