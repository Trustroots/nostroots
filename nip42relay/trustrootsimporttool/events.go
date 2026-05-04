package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

func eventForHost(record HostRecord, privateKey string) (nostr.Event, error) {
	if _, ok := decodeNpubToHex(record.User.NostrNpub); !ok {
		return nostr.Event{}, fmt.Errorf("cannot build host mirror without valid npub (missing p tag for claims)")
	}
	if record.Offer.MaxGuests <= 0 {
		return nostr.Event{}, fmt.Errorf("maxGuests is %d, not a host offer", record.Offer.MaxGuests)
	}
	if record.Offer.ValidUntil != nil && record.Offer.ValidUntil.Before(time.Now()) {
		return nostr.Event{}, fmt.Errorf("offer validUntil %v is in the past", record.Offer.ValidUntil)
	}

	createdAt := record.Offer.Updated
	if createdAt.IsZero() {
		createdAt = record.Offer.CreatedAt
	}
	if createdAt.IsZero() {
		createdAt = time.Now()
	}

	plusCode, err := encodePlusCode(record.Offer.LocationFuzzy[0], record.Offer.LocationFuzzy[1])
	if err != nil {
		return nostr.Event{}, err
	}
	coarsePlusCode := plusCodeAtGranularity(plusCode, 4)

	dTag := dTagForOffer(record.Offer.ID.Hex())
	tags := nostr.Tags{
		{"d", dTag},
		{"original_created_at", strconv.FormatInt(record.Offer.CreatedAt.Unix(), 10)},
		{"L", "open-location-code"},
		{"l", coarsePlusCode, "open-location-code"},
		{"L", "open-location-code-prefix"},
	}
	prefixTag := nostr.Tag{"l"}
	prefixTag = append(prefixTag, plusCodePrefixes(plusCode)...)
	prefixTag = append(prefixTag, "open-location-code-prefix")
	tags = append(tags, prefixTag)

	if len(record.Circles) > 0 {
		tags = append(tags, nostr.Tag{"L", "trustroots-circle"})
		seenCircleSlugs := map[string]struct{}{}
		for _, circle := range record.Circles {
			slug := strings.ToLower(strings.TrimSpace(circle))
			if slug == "" {
				continue
			}
			if _, exists := seenCircleSlugs[slug]; exists {
				continue
			}
			seenCircleSlugs[slug] = struct{}{}
			// Lowercase to match kind 30410 `d` tag and NIP-32 label value.
			tags = append(tags, nostr.Tag{"l", slug, "trustroots-circle"})
			tags = append(tags, nostr.Tag{"t", slug})
		}
	}

	tags = append(tags,
		nostr.Tag{"linkLabel", "posted by @" + record.User.Username},
		nostr.Tag{"linkPath", "/profile/" + record.User.Username},
		nostr.Tag{"t", "hosting"},
	)
	profileURL := "https://www.trustroots.org/profile/" + record.User.Username
	tags = append(tags,
		nostr.Tag{"r", profileURL},
		nostr.Tag{"trustroots", record.User.Username},
	)
	if pubkeyHex, ok := decodeNpubToHex(record.User.NostrNpub); ok {
		tags = append(tags, nostr.Tag{"p", pubkeyHex})
	}

	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      mapNoteRepostKind,
		Tags:      tags,
		Content:   buildNoteContent(record.Offer.Description, record.User),
	}
	if err := event.Sign(privateKey); err != nil {
		return nostr.Event{}, err
	}
	return event, nil
}

func deletionEvent(entry StateEntry, privateKey string, now time.Time) (nostr.Event, error) {
	tags := nostr.Tags{
		{"e", entry.EventID},
		{"k", fmt.Sprintf("%d", mapNoteRepostKind)},
	}
	if entry.DTag != "" {
		if entry.PubKey != "" {
			tags = append(tags, nostr.Tag{"a", fmt.Sprintf("%d:%s:%s", mapNoteRepostKind, entry.PubKey, entry.DTag)})
		}
	}
	event := nostr.Event{
		CreatedAt: nostr.Timestamp(now.Unix()),
		Kind:      nostr.KindDeletion,
		Tags:      tags,
		Content:   "Trustroots host is no longer eligible for export.",
	}
	if err := event.Sign(privateKey); err != nil {
		return nostr.Event{}, err
	}
	return event, nil
}

func dTagForOffer(offerID string) string {
	return "trustroots:offer:" + offerID
}

// trustrootsCircleImageURL returns a public CDN URL when the tribe has a circle image.
// Matches Trustroots client helper getCircleBackgroundUrl (742x496, jpg).
func trustrootsCircleImageURL(tribe Tribe) string {
	if !tribe.Image {
		return ""
	}
	slug := strings.TrimSpace(strings.ToLower(tribe.Slug))
	if slug == "" {
		return ""
	}
	return "https://www.trustroots.org/uploads-circle/" + slug + "/742x496.jpg"
}

func eventForCircleMetadata(tribe Tribe, privateKey string) (nostr.Event, error) {
	slug := strings.TrimSpace(strings.ToLower(tribe.Slug))
	if slug == "" {
		return nostr.Event{}, fmt.Errorf("tribe has empty slug")
	}
	name := strings.TrimSpace(tribe.Label)
	if name == "" {
		return nostr.Event{}, fmt.Errorf("tribe has empty label")
	}
	about := strings.TrimSpace(tribe.Description)
	picture := strings.TrimSpace(trustrootsCircleImageURL(tribe))
	meta := map[string]string{"name": name, "about": about}
	if picture != "" {
		meta["picture"] = picture
	}
	contentBytes, err := json.Marshal(meta)
	if err != nil {
		return nostr.Event{}, err
	}
	event := nostr.Event{
		CreatedAt: nostr.Now(),
		Kind:      circleMetadataKind,
		Tags: nostr.Tags{
			{"d", slug},
			{"L", trustrootsCircleLabelNamespace},
			{"l", slug, trustrootsCircleLabelNamespace},
			{"source", "trustroots-import"},
		},
		Content: string(contentBytes),
	}
	return event, event.Sign(privateKey)
}
