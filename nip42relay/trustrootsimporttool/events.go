package main

import (
	"fmt"
	"strconv"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

func eventForHost(record HostRecord, privateKey string) (nostr.Event, error) {
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

	dTag := dTagForOffer(record.Offer.ID.Hex())
	tags := nostr.Tags{
		{"d", dTag},
		{"original_created_at", strconv.FormatInt(record.Offer.CreatedAt.Unix(), 10)},
		{"L", "open-location-code"},
		{"l", plusCode, "open-location-code"},
		{"L", "open-location-code-prefix"},
	}
	prefixTag := nostr.Tag{"l"}
	prefixTag = append(prefixTag, plusCodePrefixes(plusCode)...)
	prefixTag = append(prefixTag, "open-location-code-prefix")
	tags = append(tags, prefixTag)

	if len(record.Circles) > 0 {
		tags = append(tags, nostr.Tag{"L", "trustroots-circle"})
		for _, circle := range record.Circles {
			tags = append(tags, nostr.Tag{"l", circle, "trustroots-circle"})
		}
	}

	tags = append(tags,
		nostr.Tag{"linkLabel", "posted by @" + record.User.Username},
		nostr.Tag{"linkPath", "/profile/" + record.User.Username},
	)

	event := nostr.Event{
		CreatedAt: nostr.Timestamp(createdAt.Unix()),
		Kind:      mapNoteRepostKind,
		Tags:      tags,
		Content:   cleanContent(record.Offer.Description),
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
