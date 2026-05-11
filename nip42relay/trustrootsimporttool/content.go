package main

import (
	"html"
	"regexp"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr/nip19"
)

var (
	htmlTagPattern = regexp.MustCompile(`<[^>]*>`)
	spacePattern   = regexp.MustCompile(`\s+`)
)

func cleanContent(description string) string {
	text := htmlTagPattern.ReplaceAllString(description, " ")
	text = html.UnescapeString(text)
	text = strings.ReplaceAll(text, "\u00a0", " ")
	text = spacePattern.ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	if len([]rune(text)) < 3 {
		text = "Trustroots host"
	}
	return text
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func buildNoteContent(description string, user User) string {
	base := cleanContent(description)
	suffix := "\n\n#hosting"
	suffixRunes := len([]rune(suffix))

	if suffixRunes >= maxContentLength {
		return truncateRunes(suffix, maxContentLength)
	}

	allowedBaseRunes := maxContentLength - suffixRunes
	base = truncateRunes(base, allowedBaseRunes)
	return base + suffix
}

func normalizeHostOfferStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

func isAllowedHostOfferStatus(status string) bool {
	switch normalizeHostOfferStatus(status) {
	case "yes", "maybe":
		return true
	default:
		return false
	}
}

func hasBlockedRole(user User) bool {
	for _, role := range user.Roles {
		normalized := strings.ToLower(strings.TrimSpace(role))
		if normalized == "suspended" || normalized == "shadowban" || strings.Contains(normalized, "shadow") || strings.Contains(normalized, "ban") {
			return true
		}
	}
	return false
}

func isEmailConfirmed(user User) bool {
	if user.EmailUnconfirmed {
		return false
	}
	if user.EmailConfirmed != nil {
		return *user.EmailConfirmed
	}
	return true
}

func decodeNpubToHex(npub string) (string, bool) {
	prefix, decoded, err := nip19.Decode(strings.TrimSpace(npub))
	if err != nil || prefix != "npub" {
		return "", false
	}
	pubkeyHex, ok := decoded.(string)
	if !ok || pubkeyHex == "" {
		return "", false
	}
	return pubkeyHex, true
}

func hasValidNpub(user User) bool {
	_, ok := decodeNpubToHex(user.NostrNpub)
	return ok
}

func isEligibleHost(offer Offer, user User) bool {
	if offer.Type != "host" {
		return false
	}
	if !isAllowedHostOfferStatus(offer.Status) {
		return false
	}
	if offer.ShowOnlyInMyCircles {
		return false
	}
	// Trustroots: maxGuests 0 means no capacity — not a publishable host offer.
	if offer.MaxGuests <= 0 {
		return false
	}
	if offer.ValidUntil != nil && offer.ValidUntil.Before(time.Now()) {
		return false
	}
	if len(offer.LocationFuzzy) != 2 {
		return false
	}
	if offer.LocationFuzzy[0] < -90 || offer.LocationFuzzy[0] > 90 ||
		offer.LocationFuzzy[1] < -180 || offer.LocationFuzzy[1] > 180 {
		return false
	}
	if !user.Public || user.Username == "" || hasBlockedRole(user) || !isEmailConfirmed(user) {
		return false
	}
	if !hasValidNpub(user) {
		return false
	}
	return true
}

func isEligibleUser(user User) bool {
	if !user.Public || user.Username == "" {
		return false
	}
	if hasBlockedRole(user) || !isEmailConfirmed(user) {
		return false
	}
	return hasValidNpub(user)
}

// isRelaxedTrustrootsUser is the same gate as isEligibleUser but does not require an npub.
// Used for contact/experience endpoints so pairs can export when only one side has a pubkey.
func isRelaxedTrustrootsUser(user User) bool {
	if !user.Public || user.Username == "" {
		return false
	}
	if hasBlockedRole(user) || !isEmailConfirmed(user) {
		return false
	}
	return true
}

func isPositiveExperience(experience Experience) bool {
	if experience.Hidden {
		return false
	}
	if !experience.Public {
		return false
	}
	if experience.Positive || bool(experience.Recommend) {
		return true
	}
	recommendation := strings.ToLower(strings.TrimSpace(experience.Recommendation))
	switch recommendation {
	case "yes", "positive", "recommend", "recommended", "vouch":
		return true
	default:
		return false
	}
}
