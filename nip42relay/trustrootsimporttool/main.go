package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cfg, err := loadConfig(args)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	if err := validatePrivateKey(cfg.NostrSK); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Keep reading state so existing state files remain valid for future re-enable.
	if _, err := loadState(cfg.StateFile); err != nil {
		return fmt.Errorf("load state: %w", err)
	}
	records, err := fetchHosts(ctx, cfg.MongoURI, cfg.Limit)
	if err != nil {
		return fmt.Errorf("fetch hosts: %w", err)
	}
	client, db, err := openMongo(ctx, cfg.MongoURI)
	if err != nil {
		return fmt.Errorf("open mongo: %w", err)
	}
	defer client.Disconnect(ctx)
	eligibleUsers, usersByID, err := fetchEligibleUsers(ctx, db)
	if err != nil {
		return fmt.Errorf("fetch eligible users: %w", err)
	}
	contacts, err := fetchContactRecords(ctx, db, usersByID, cfg.Limit)
	if err != nil {
		return fmt.Errorf("fetch contacts: %w", err)
	}
	experiences, err := fetchExperienceRecords(ctx, db, usersByID, cfg.Limit)
	if err != nil {
		return fmt.Errorf("fetch experiences: %w", err)
	}
	checker := newRelayChecker(cfg.CheckRelayURLs, cfg.NostrSK)

	outputFile, err := os.Create(cfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer outputFile.Close()
	writer := bufio.NewWriter(outputFile)
	defer writer.Flush()

	current := State{Offers: map[string]StateEntry{}}
	exported := 0
	profileSuggestions := 0
	relationshipSuggestions := 0
	experienceSuggestions := 0
	relationPairs := map[string]struct{}{}
	seenExperienceSource := map[string]struct{}{}

	for _, user := range eligibleUsers {
		alreadyHasProfile, err := checker.HasProfile(ctx, user)
		if err != nil {
			return fmt.Errorf("check profile for user %s: %w", user.ID.Hex(), err)
		}
		if alreadyHasProfile {
			continue
		}
		event, err := eventForProfileClaim(user, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create profile claim for user %s: %w", user.ID.Hex(), err)
		}
		if err := writeJSONLine(writer, event); err != nil {
			return err
		}
		profileSuggestions++
	}

	for _, record := range records {
		userPubKeyHex, ok := decodeNpubToHex(record.User.NostrNpub)
		if !ok {
			continue
		}
		alreadyHasHost, err := checker.HasHostOffer(ctx, userPubKeyHex, record.Offer.ID.Hex())
		if err != nil {
			return fmt.Errorf("check host offer for %s: %w", record.Offer.ID.Hex(), err)
		}
		if alreadyHasHost {
			continue
		}
		event, err := eventForHost(record, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create event for offer %s: %w", record.Offer.ID.Hex(), err)
		}
		if err := writeJSONLine(writer, event); err != nil {
			return err
		}
		claimEvent, err := eventForHostClaimSuggestion(record, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create host claim event for offer %s: %w", record.Offer.ID.Hex(), err)
		}
		if err := writeJSONLine(writer, claimEvent); err != nil {
			return err
		}
		offerID := record.Offer.ID.Hex()
		current.Offers[offerID] = StateEntry{
			EventID: event.ID,
			DTag:    dTagForOffer(offerID),
			PubKey:  event.PubKey,
		}
		exported++
		if cfg.LogEvery > 0 && exported%cfg.LogEvery == 0 {
			fmt.Fprintf(os.Stderr, "exported %d hosts\n", exported)
		}
	}

	for _, record := range contacts {
		sourceHex, okSource := decodeNpubToHex(record.User.NostrNpub)
		targetHex, okTarget := decodeNpubToHex(record.Other.NostrNpub)
		if !okSource || !okTarget {
			continue
		}
		pairKey := sourceHex + ":" + targetHex
		if _, seen := relationPairs[pairKey]; seen {
			continue
		}
		alreadyHasRelationship, err := checker.HasRelationship(ctx, sourceHex, targetHex)
		if err != nil {
			return fmt.Errorf("check relationship %s: %w", pairKey, err)
		}
		if alreadyHasRelationship {
			continue
		}
		event, err := eventForRelationshipClaim(record, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create relationship claim for %s: %w", pairKey, err)
		}
		if err := writeJSONLine(writer, event); err != nil {
			return err
		}
		relationPairs[pairKey] = struct{}{}
		relationshipSuggestions++
	}

	for _, record := range experiences {
		authorHex, okAuthor := decodeNpubToHex(record.Author.NostrNpub)
		targetHex, okTarget := decodeNpubToHex(record.Target.NostrNpub)
		if !okAuthor || !okTarget {
			continue
		}
		sourceID := record.Experience.ID.Hex()
		if _, seen := seenExperienceSource[sourceID]; seen {
			continue
		}
		alreadyHasExperience, err := checker.HasPositiveExperience(ctx, authorHex, targetHex, sourceID)
		if err != nil {
			return fmt.Errorf("check positive experience %s: %w", sourceID, err)
		}
		if alreadyHasExperience {
			continue
		}
		event, err := eventForExperienceClaim(record, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create experience claim %s: %w", sourceID, err)
		}
		if err := writeJSONLine(writer, event); err != nil {
			return err
		}
		seenExperienceSource[sourceID] = struct{}{}
		experienceSuggestions++
	}

	// Temporarily disabled: do not emit deletion events for stale offers.
	deleted := 0

	if err := writer.Flush(); err != nil {
		return err
	}
	if err := saveState(cfg.StateFile, current); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	fmt.Fprintf(
		os.Stderr,
		"wrote %s: exported_hosts=%d profile_claims=%d relationship_claims=%d experience_claims=%d deletions=%d state=%s\n",
		cfg.Output,
		exported,
		profileSuggestions,
		relationshipSuggestions,
		experienceSuggestions,
		deleted,
		cfg.StateFile,
	)
	return nil
}

func writeJSONLine(writer *bufio.Writer, value any) error {
	bytes, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if _, err := writer.Write(bytes); err != nil {
		return err
	}
	return writer.WriteByte('\n')
}
