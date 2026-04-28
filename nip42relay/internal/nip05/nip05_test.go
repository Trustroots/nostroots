package nip05

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestVerify(t *testing.T) {
	client := Client{
		BaseURL: "https://example.test/.well-known/nostr.json",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Query().Get("name") != "alice" {
				t.Fatalf("expected name alice, got %s", r.URL.Query().Get("name"))
			}
			return jsonResponse(`{"names":{"alice":"pubkey123"}}`), nil
		})},
	}
	if err := client.Verify(context.Background(), "alice", "pubkey123"); err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
}

func TestVerifyMismatch(t *testing.T) {
	client := Client{
		BaseURL: "https://example.test/.well-known/nostr.json",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return jsonResponse(`{"names":{"alice":"other"}}`), nil
		})},
	}
	if err := client.Verify(context.Background(), "alice", "pubkey123"); err != ErrNoMatch {
		t.Fatalf("expected ErrNoMatch, got %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}
