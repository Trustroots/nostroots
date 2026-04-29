package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

func eventForProfileClaim(user User, privateKey string) (nostr.Event, error) {
	pubkeyHex, _ := decodeNpubToHex(user.NostrNpub)
	profileURL := "https://www.trustroots.org/profile/" + user.Username
	metadata := map[string]string{
		"name":               user.Username,
		"display_name":       strings.TrimSpace(user.DisplayName),
		"about":              strings.TrimSpace(user.Description),
		"picture":            strings.TrimSpace(user.Avatar),
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

func eventForRelationshipClaim(record ContactRecord, privateKey string) (nostr.Event, error) {
	sourceHex, _ := decodeNpubToHex(record.User.NostrNpub)
	targetHex, _ := decodeNpubToHex(record.Other.NostrNpub)
	createdAt := record.Contact.Updated
	if createdAt.IsZero() {
		createdAt = record.Contact.CreatedAt
	}
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	dTag := fmt.Sprintf("trustroots:contact:%s:%s", record.User.ID.Hex(), record.Other.ID.Hex())
	content := fmt.Sprintf("Trustroots relationship suggestion: @%s -> @%s", record.User.Username, record.Other.Username)
	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      relationClaimKind,
		Tags: nostr.Tags{
			{"d", dTag},
			{"p", sourceHex},
			{"p", targetHex},
			{"L", "org.trustroots:relationship"},
			{"l", "contact", "org.trustroots:relationship"},
			{"source", "trustroots-import"},
			{"source_id", record.Contact.ID.Hex()},
		},
		Content: content,
	}
	return event, event.Sign(privateKey)
}

func eventForExperienceClaim(record ExperienceRecord, privateKey string) (nostr.Event, error) {
	authorHex, _ := decodeNpubToHex(record.Author.NostrNpub)
	targetHex, _ := decodeNpubToHex(record.Target.NostrNpub)
	createdAt := record.Experience.Updated
	if createdAt.IsZero() {
		createdAt = record.Experience.CreatedAt
	}
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	text := strings.TrimSpace(record.Experience.Text)
	if text == "" {
		text = strings.TrimSpace(record.Experience.Description)
	}
	if text == "" {
		text = "Trustroots positive experience"
	}
	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      experienceClaimKind,
		Tags: nostr.Tags{
			{"d", "trustroots:experience:" + record.Experience.ID.Hex()},
			{"p", authorHex},
			{"p", targetHex},
			{"L", "org.trustroots:experience"},
			{"l", "positive", "org.trustroots:experience"},
			{"source", "trustroots-import"},
			{"source_id", record.Experience.ID.Hex()},
		},
		Content: text,
	}
	return event, event.Sign(privateKey)
}
