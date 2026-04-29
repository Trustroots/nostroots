package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

type relayChecker struct {
	relayURLs  []string
	privateKey string
}

func newRelayChecker(relayURLs []string, privateKey string) ExistingDataChecker {
	clean := make([]string, 0, len(relayURLs))
	for _, url := range relayURLs {
		trimmed := strings.TrimSpace(url)
		if trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	if len(clean) == 0 {
		return noopChecker{}
	}
	return &relayChecker{relayURLs: clean, privateKey: privateKey}
}

func (c *relayChecker) ensureAuthedRelay(ctx context.Context, url string) (*nostr.Relay, error) {
	relay, err := nostr.RelayConnect(ctx, url)
	if err != nil {
		return nil, err
	}
	authCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	if err := relay.Auth(authCtx, func(event *nostr.Event) error { return event.Sign(c.privateKey) }); err != nil {
		relay.Close()
		return nil, fmt.Errorf("auth failed: %w", err)
	}
	return relay, nil
}

func (c *relayChecker) queryAll(ctx context.Context, filter nostr.Filter) ([]*nostr.Event, error) {
	all := make([]*nostr.Event, 0, 16)
	for _, relayURL := range c.relayURLs {
		relay, err := c.ensureAuthedRelay(ctx, relayURL)
		if err != nil {
			continue
		}
		queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		events, err := relay.QuerySync(queryCtx, filter)
		cancel()
		relay.Close()
		if err != nil {
			continue
		}
		all = append(all, events...)
	}
	return all, nil
}

func (c *relayChecker) HasProfile(ctx context.Context, user User) (bool, error) {
	pubkeyHex, ok := decodeNpubToHex(user.NostrNpub)
	if !ok {
		return false, nil
	}
	events, err := c.queryAll(ctx, nostr.Filter{
		Authors: []string{pubkeyHex},
		Kinds:   []int{0},
		Limit:   20,
	})
	if err != nil {
		return false, err
	}
	for _, event := range events {
		var metadata map[string]any
		if err := json.Unmarshal([]byte(event.Content), &metadata); err != nil {
			continue
		}
		if hasMatchingProfileMetadata(metadata, user) {
			return true, nil
		}
	}
	return false, nil
}

func hasMatchingProfileMetadata(metadata map[string]any, user User) bool {
	username := strings.ToLower(strings.TrimSpace(user.Username))
	nip05Any, hasNip05 := metadata["nip05"]
	if hasNip05 {
		if nip05, ok := nip05Any.(string); ok && strings.ToLower(strings.TrimSpace(nip05)) == username+"@trustroots.org" {
			return true
		}
	}
	trAny, hasTR := metadata["trustrootsUsername"]
	if hasTR {
		if trustrootsUsername, ok := trAny.(string); ok && strings.ToLower(strings.TrimSpace(trustrootsUsername)) == username {
			return true
		}
	}
	nameAny, hasName := metadata["name"]
	if hasName {
		if name, ok := nameAny.(string); ok && strings.EqualFold(strings.TrimSpace(name), user.Username) {
			return true
		}
	}
	return false
}

func (c *relayChecker) HasHostOffer(ctx context.Context, userPubkeyHex, offerID string) (bool, error) {
	events, err := c.queryAll(ctx, nostr.Filter{
		Authors: []string{userPubkeyHex},
		Kinds:   []int{userMapNoteKind},
		Tags: nostr.TagMap{
			"d": []string{
				"trustroots:offer:" + offerID,
			},
		},
		Limit: 5,
	})
	if err != nil {
		return false, err
	}
	if len(events) > 0 {
		return true, nil
	}
	events, err = c.queryAll(ctx, nostr.Filter{
		Authors: []string{userPubkeyHex},
		Kinds:   []int{userMapNoteKind},
		Tags: nostr.TagMap{
			"source_id": []string{offerID},
		},
		Limit: 5,
	})
	if err != nil {
		return false, err
	}
	return len(events) > 0, nil
}

func (c *relayChecker) HasRelationship(ctx context.Context, sourcePubkeyHex, targetPubkeyHex string) (bool, error) {
	k3, err := c.queryAll(ctx, nostr.Filter{
		Authors: []string{sourcePubkeyHex},
		Kinds:   []int{nip02FollowKind},
		Limit:   5,
	})
	if err != nil {
		return false, err
	}
	for _, event := range k3 {
		if event.Tags.ContainsAny("p", []string{targetPubkeyHex}) {
			return true, nil
		}
	}
	k30000, err := c.queryAll(ctx, nostr.Filter{
		Authors: []string{sourcePubkeyHex},
		Kinds:   []int{nip51FollowSetKind},
		Tags: nostr.TagMap{
			"d": []string{"trustroots-contacts"},
		},
		Limit: 10,
	})
	if err != nil {
		return false, err
	}
	for _, event := range k30000 {
		if event.Tags.ContainsAny("p", []string{targetPubkeyHex}) {
			return true, nil
		}
	}
	return false, nil
}

func (c *relayChecker) HasPositiveExperience(ctx context.Context, authorPubkeyHex, targetPubkeyHex, sourceID string) (bool, error) {
	events, err := c.queryAll(ctx, nostr.Filter{
		Authors: []string{authorPubkeyHex},
		Kinds:   []int{nip32LabelKind},
		Tags: nostr.TagMap{
			"p": []string{targetPubkeyHex},
			"d": []string{sourceID},
		},
		Limit: 5,
	})
	if err != nil {
		return false, err
	}
	for _, event := range events {
		if event.Tags.ContainsAny("l", []string{"positive"}) || strings.EqualFold(strings.TrimSpace(event.Content), "positive") {
			return true, nil
		}
	}
	return false, nil
}
