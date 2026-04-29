package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

type ExistingDataChecker interface {
	HasProfile(ctx context.Context, user User) (bool, error)
	HasHostOffer(ctx context.Context, userPubkeyHex, offerID string) (bool, error)
	HasRelationship(ctx context.Context, sourcePubkeyHex, targetPubkeyHex string) (bool, error)
	HasPositiveExperience(ctx context.Context, authorPubkeyHex, targetPubkeyHex, sourceID string) (bool, error)
}

type noopChecker struct{}

func (noopChecker) HasProfile(context.Context, User) (bool, error) { return false, nil }
func (noopChecker) HasHostOffer(context.Context, string, string) (bool, error) {
	return false, nil
}
func (noopChecker) HasRelationship(context.Context, string, string) (bool, error) {
	return false, nil
}
func (noopChecker) HasPositiveExperience(context.Context, string, string, string) (bool, error) {
	return false, nil
}

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
	contentBytes, _ := json.Marshal(metadata)
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

func eventForHostClaimSuggestion(record HostRecord, privateKey string) (nostr.Event, error) {
	base, err := eventForHost(record, privateKey)
	if err != nil {
		return nostr.Event{}, err
	}
	pubkeyHex, _ := decodeNpubToHex(record.User.NostrNpub)
	base.Kind = hostClaimKind
	base.Tags = append(base.Tags,
		nostr.Tag{"p", pubkeyHex},
		nostr.Tag{"source", "trustroots-import"},
		nostr.Tag{"source_id", record.Offer.ID.Hex()},
	)
	return base, base.Sign(privateKey)
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

func buildClaimedRelationshipKind3(sourcePubkeyHex string, targets []string) nostr.Event {
	tags := make(nostr.Tags, 0, len(targets))
	for _, target := range targets {
		tags = append(tags, nostr.Tag{"p", target})
	}
	return nostr.Event{
		Kind:    nip02FollowKind,
		PubKey:  sourcePubkeyHex,
		Tags:    tags,
		Content: "",
	}
}

func buildClaimedTrustrootsFollowSet(sourcePubkeyHex string, targets []string) nostr.Event {
	tags := make(nostr.Tags, 0, len(targets)+1)
	tags = append(tags, nostr.Tag{"d", "trustroots-contacts"})
	for _, target := range targets {
		tags = append(tags, nostr.Tag{"p", target})
	}
	return nostr.Event{
		Kind:    nip51FollowSetKind,
		PubKey:  sourcePubkeyHex,
		Tags:    tags,
		Content: "",
	}
}

func buildClaimedExperienceLabel(authorPubkeyHex, targetPubkeyHex, sourceID string) nostr.Event {
	return nostr.Event{
		Kind:   nip32LabelKind,
		PubKey: authorPubkeyHex,
		Tags: nostr.Tags{
			{"p", targetPubkeyHex},
			{"d", sourceID},
			{"L", "org.trustroots:experience"},
			{"l", "positive", "org.trustroots:experience"},
		},
		Content: "positive",
	}
}

func plusCodeClaimTag(offerID string) nostr.Tag {
	return nostr.Tag{"d", "trustroots:offer:" + offerID}
}

func safeUnixTimestamp(t time.Time) string {
	if t.IsZero() {
		return strconv.FormatInt(time.Now().Unix(), 10)
	}
	return strconv.FormatInt(t.Unix(), 10)
}
