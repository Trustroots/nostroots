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

	appendTrustrootsCircleMembershipTags(&tags, record.Circles)

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

// trustrootsCircleSlugForNostr lowercases, trims, and strips ASCII hyphens from Mongo tribe
// slugs for Nostr d / l / t tags (e.g. beer-brewers -> beerbrewers). CDN picture URLs keep
// the Mongo path via trustrootsCircleImageURL (hyphens preserved there).
func trustrootsCircleSlugForNostr(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	return strings.ReplaceAll(s, "-", "")
}

// appendTrustrootsCircleMembershipTags appends NIP-32 `L`/`l` and `t` tags for public circle
// memberships (same shape on kind 30390 profile claims and 30398 host mirrors).
func appendTrustrootsCircleMembershipTags(tags *nostr.Tags, circles []string) {
	if len(circles) == 0 {
		return
	}
	*tags = append(*tags, nostr.Tag{"L", trustrootsCircleLabelNamespace})
	seen := make(map[string]struct{}, len(circles))
	for _, circle := range circles {
		slug := trustrootsCircleSlugForNostr(circle)
		if slug == "" {
			continue
		}
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}
		*tags = append(*tags, nostr.Tag{"l", slug, trustrootsCircleLabelNamespace})
		*tags = append(*tags, nostr.Tag{"t", slug})
	}
}

func eventForCircleMetadata(tribe Tribe, privateKey string) (nostr.Event, error) {
	rawSlug := strings.TrimSpace(strings.ToLower(tribe.Slug))
	if rawSlug == "" {
		return nostr.Event{}, fmt.Errorf("tribe has empty slug")
	}
	slug := trustrootsCircleSlugForNostr(tribe.Slug)
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
