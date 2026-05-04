package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

// profileClaimPictureURL matches Trustroots API / web behaviour for profile images.
// Served from www.trustroots.org (browsers load it on nos.trustroots.org via normal <img cross-origin>).
func profileClaimPictureURL(u User) string {
	if s := strings.TrimSpace(u.Avatar); s != "" {
		return s
	}
	src := strings.ToLower(strings.TrimSpace(u.AvatarSource))
	if src == "local" && u.AvatarUploaded && !u.ID.IsZero() {
		base := fmt.Sprintf("https://www.trustroots.org/uploads-profile/%s/avatar/256.jpg", u.ID.Hex())
		if !u.Updated.IsZero() {
			return base + fmt.Sprintf("?%d", u.Updated.UnixMilli())
		}
		return base
	}
	if src == "gravatar" {
		h := strings.TrimSpace(strings.ToLower(u.EmailHash))
		if h != "" {
			return fmt.Sprintf("https://www.gravatar.com/avatar/%s?s=256&d=identicon", h)
		}
	}
	return ""
}

func eventForProfileClaim(user User, privateKey string) (nostr.Event, error) {
	pubkeyHex, _ := decodeNpubToHex(user.NostrNpub)
	profileURL := "https://www.trustroots.org/profile/" + user.Username
	metadata := map[string]string{
		"name":               user.Username,
		"display_name":       strings.TrimSpace(user.DisplayName),
		"about":              strings.TrimSpace(user.Description),
		"picture":            profileClaimPictureURL(user),
		"nip05":              strings.ToLower(strings.TrimSpace(user.Username)) + "@trustroots.org",
		"trustrootsUsername": strings.TrimSpace(user.Username),
	}
	contentBytes, err := json.Marshal(metadata)
	if err != nil {
		return nostr.Event{}, err
	}
	event := nostr.Event{
		CreatedAt: nostr.Now(),
		Kind:      profileClaimKind,
		Tags: nostr.Tags{
			{"d", "trustroots:profile:" + strings.ToLower(user.Username)},
			{"p", pubkeyHex},
			{"L", TrustrootsUsernameLabelNamespace},
			{"l", strings.ToLower(user.Username), TrustrootsUsernameLabelNamespace},
			{"r", profileURL},
			{"source", "trustroots-import"},
		},
		Content: string(contentBytes),
	}
	return event, event.Sign(privateKey)
}

// appendParticipantPTagOrUsernameLabels adds either a pubkey `p` tag (when npub is valid)
// or NIP-32 username labels for Trustroots (when npub is missing). Order is stable per caller.
func appendParticipantPTagOrUsernameLabels(tags *nostr.Tags, u User) {
	if hex, ok := decodeNpubToHex(u.NostrNpub); ok && hex != "" {
		*tags = append(*tags, nostr.Tag{"p", hex})
		return
	}
	name := strings.TrimSpace(u.Username)
	if name == "" {
		return
	}
	*tags = append(*tags,
		nostr.Tag{"L", TrustrootsUsernameLabelNamespace},
		nostr.Tag{"l", strings.ToLower(name), TrustrootsUsernameLabelNamespace},
	)
}

func tagsContainHexPubkeyPTag(tags nostr.Tags) bool {
	for _, t := range tags {
		if len(t) >= 2 && t[0] == "p" && isLikelyHexPubkey(t[1]) {
			return true
		}
	}
	return false
}

func isLikelyHexPubkey(s string) bool {
	s = strings.ToLower(strings.TrimSpace(s))
	if len(s) != 64 {
		return false
	}
	for _, c := range s {
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') {
			continue
		}
		return false
	}
	return true
}

func eventForRelationshipClaim(record ContactRecord, privateKey string) (nostr.Event, error) {
	createdAt := record.Contact.Created
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	dTag := fmt.Sprintf("trustroots:contact:%s:%s", record.User.ID.Hex(), record.Other.ID.Hex())
	content := fmt.Sprintf("Trustroots relationship suggestion: @%s -> @%s", record.User.Username, record.Other.Username)

	var pairTags nostr.Tags
	appendParticipantPTagOrUsernameLabels(&pairTags, record.User)
	appendParticipantPTagOrUsernameLabels(&pairTags, record.Other)
	if !tagsContainHexPubkeyPTag(pairTags) {
		return nostr.Event{}, fmt.Errorf("relationship claim needs at least one valid npub (hex p tag)")
	}

	tags := nostr.Tags{
		{"d", dTag},
	}
	tags = append(tags, pairTags...)
	tags = append(tags,
		nostr.Tag{"L", "org.trustroots:relationship"},
		nostr.Tag{"l", "contact", "org.trustroots:relationship"},
		nostr.Tag{"source", "trustroots-import"},
		nostr.Tag{"source_id", record.Contact.ID.Hex()},
	)

	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      relationClaimKind,
		Tags:      tags,
		Content:   content,
	}
	return event, event.Sign(privateKey)
}

func eventForExperienceClaim(record ExperienceRecord, privateKey string) (nostr.Event, error) {
	createdAt := record.Experience.Created
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	text := strings.TrimSpace(record.Experience.FeedbackPublic)
	if text == "" {
		text = "Trustroots positive experience"
	}

	var pairTags nostr.Tags
	appendParticipantPTagOrUsernameLabels(&pairTags, record.Author)
	appendParticipantPTagOrUsernameLabels(&pairTags, record.Target)
	if !tagsContainHexPubkeyPTag(pairTags) {
		return nostr.Event{}, fmt.Errorf("experience claim needs at least one valid npub (hex p tag)")
	}

	tags := nostr.Tags{
		{"d", "trustroots:experience:" + record.Experience.ID.Hex()},
	}
	tags = append(tags, pairTags...)
	tags = append(tags,
		nostr.Tag{"L", "org.trustroots:experience"},
		nostr.Tag{"l", "positive", "org.trustroots:experience"},
		nostr.Tag{"source", "trustroots-import"},
		nostr.Tag{"source_id", record.Experience.ID.Hex()},
	)

	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      experienceClaimKind,
		Tags:      tags,
		Content:   text,
	}
	return event, event.Sign(privateKey)
}
