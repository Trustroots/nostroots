package relay

import (
	"testing"
)

func TestProfileRelayURLsIncludesConfiguredAndPublicFallbacks(t *testing.T) {
	u := Upstream{URL: "ws://strfry:5542"}
	got := u.profileRelayURLs()
	if len(got) < 3 {
		t.Fatalf("expected configured relay plus public fallbacks, got %v", got)
	}
	if got[0] != "ws://strfry:5542" {
		t.Fatalf("expected configured upstream first, got %s", got[0])
	}
	foundTrustroots := false
	foundNomad := false
	for _, url := range got {
		if url == "wss://relay.trustroots.org" {
			foundTrustroots = true
		}
		if url == "wss://relay.nomadwiki.org" {
			foundNomad = true
		}
	}
	if !foundTrustroots || !foundNomad {
		t.Fatalf("expected both public fallback relays in list, got %v", got)
	}
}
