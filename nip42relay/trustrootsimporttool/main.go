package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
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

	limitLabel := "no limit"
	if cfg.Limit > 0 {
		limitLabel = fmt.Sprintf("%d", cfg.Limit)
	}
	logf("starting (mongo=%s, output=%q, state=%q, limit=%s, log-every=%d)",
		redactMongoURI(cfg.MongoURI), cfg.Output, cfg.StateFile, limitLabel, cfg.LogEvery)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if _, err := os.Stat(cfg.StateFile); err == nil {
		logf("reading state from %q", cfg.StateFile)
	} else if os.IsNotExist(err) {
		logf("state file %q does not exist yet (first run)", cfg.StateFile)
	} else {
		return fmt.Errorf("stat state file: %w", err)
	}
	if _, err := loadState(cfg.StateFile); err != nil {
		return fmt.Errorf("load state: %w", err)
	}

	logf("fetching public host offers from MongoDB (connect timeout %v)…", mongoClientTimeout)
	t0 := time.Now()
	records, err := fetchHosts(ctx, cfg.MongoURI, cfg.Limit)
	if err != nil {
		return fmt.Errorf("fetch hosts: %w", err)
	}
	logf("loaded %d host offer row(s) in %s", len(records), time.Since(t0).Truncate(time.Millisecond))

	logf("connecting to MongoDB for profiles, contacts, and experiences (eligible users)…")
	t0 = time.Now()
	client, db, err := openMongo(ctx, cfg.MongoURI)
	if err != nil {
		return fmt.Errorf("open mongo: %w", err)
	}
	defer client.Disconnect(ctx)
	logf("connected in %s", time.Since(t0).Truncate(time.Millisecond))

	eligibleUsers, usersByID, err := fetchEligibleUsers(ctx, db)
	if err != nil {
		return fmt.Errorf("fetch eligible users: %w", err)
	}
	logf("loaded %d eligible user(s) (public, confirmed email, npub)", len(eligibleUsers))

	// Do not apply -limit to contacts/experiences: it only constrained early _id
	// rows and often returned zero pairs overlapping eligible users.
	contacts, err := fetchContactRecords(ctx, db, usersByID, 0)
	if err != nil {
		return fmt.Errorf("fetch contacts: %w", err)
	}
	logf("loaded %d contact pair(s) (both users eligible)", len(contacts))

	experiences, err := fetchExperienceRecords(ctx, db, usersByID, 0)
	if err != nil {
		return fmt.Errorf("fetch experiences: %w", err)
	}
	logf("loaded %d positive experience(s) (both users eligible)", len(experiences))

	logf("opening output file %q", cfg.Output)
	outputFile, err := os.Create(cfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer outputFile.Close()
	writer := bufio.NewWriter(outputFile)
	defer writer.Flush()

	current := State{Offers: map[string]StateEntry{}}
	profileLines := 0
	exported := 0
	relationshipLines := 0
	experienceLines := 0
	relationPairs := map[string]struct{}{}
	seenExperienceSource := map[string]struct{}{}

	logf("phase 1/4: profile claim events (kind %d) — %d user(s)…", profileClaimKind, len(eligibleUsers))
	for i, user := range eligibleUsers {
		event, err := eventForProfileClaim(user, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create profile claim for user %s: %w", user.ID.Hex(), err)
		}
		if err := writeJSONLine(writer, event); err != nil {
			return err
		}
		profileLines++
		if cfg.LogEvery > 0 && (i+1)%cfg.LogEvery == 0 {
			logf("…profile phase: %d/%d user(s), %d line(s) emitted", i+1, len(eligibleUsers), profileLines)
		}
	}
	logf("phase 1 done: %d profile line(s)", profileLines)

	logf("phase 2/4: host mirror events (kind %d) — %d offer row(s)…", mapNoteRepostKind, len(records))
	skippedHost := 0
	for _, record := range records {
		event, err := eventForHost(record, cfg.NostrSK)
		if err != nil {
			logf("skip host offer %s: %v", record.Offer.ID.Hex(), err)
			skippedHost++
			continue
		}
		if err := writeJSONLine(writer, event); err != nil {
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
			logf("…exported %d host offer(s) so far", exported)
		}
	}
	if skippedHost > 0 {
		logf("phase 2 skipped %d host offer(s) that were not exportable", skippedHost)
	}
	logf("phase 2 done: %d host mirror line(s)", exported)

	logf("phase 3/4: relationship claims (kind %d) — %d contact row(s)…", relationClaimKind, len(contacts))
	for i, record := range contacts {
		sourceHex, okSource := decodeNpubToHex(record.User.NostrNpub)
		targetHex, okTarget := decodeNpubToHex(record.Other.NostrNpub)
		if !okSource || !okTarget {
			continue
		}
		pairKey := sourceHex + ":" + targetHex
		if _, seen := relationPairs[pairKey]; seen {
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
		relationshipLines++
		if cfg.LogEvery > 0 && (i+1)%cfg.LogEvery == 0 {
			logf("…relationship phase: scanned %d/%d contacts, %d line(s) emitted", i+1, len(contacts), relationshipLines)
		}
	}
	logf("phase 3 done: %d relationship claim line(s)", relationshipLines)

	logf("phase 4/4: experience claims (kind %d) — %d experience row(s)…", experienceClaimKind, len(experiences))
	for i, record := range experiences {
		if _, ok := decodeNpubToHex(record.Author.NostrNpub); !ok {
			continue
		}
		if _, ok := decodeNpubToHex(record.Target.NostrNpub); !ok {
			continue
		}
		sourceID := record.Experience.ID.Hex()
		if _, seen := seenExperienceSource[sourceID]; seen {
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
		experienceLines++
		if cfg.LogEvery > 0 && (i+1)%cfg.LogEvery == 0 {
			logf("…experience phase: scanned %d/%d rows, %d line(s) emitted", i+1, len(experiences), experienceLines)
		}
	}
	logf("phase 4 done: %d experience claim line(s)", experienceLines)

	deleted := 0

	logf("flushing JSONL and writing state to %q…", cfg.StateFile)
	if err := writer.Flush(); err != nil {
		return err
	}
	if err := saveState(cfg.StateFile, current); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	fmt.Fprintf(
		os.Stderr,
		"trustrootsimporttool: wrote %q — profile_claims=%d exported_hosts=%d relationship_claims=%d experience_claims=%d deletions=%d state=%q\n",
		cfg.Output,
		profileLines,
		exported,
		relationshipLines,
		experienceLines,
		deleted,
		cfg.StateFile,
	)
	return nil
}

func logf(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	if !strings.HasSuffix(msg, "\n") {
		msg += "\n"
	}
	fmt.Fprint(os.Stderr, "trustrootsimporttool: ", msg)
}

func redactMongoURI(uri string) string {
	at := strings.LastIndex(uri, "@")
	if at <= 0 {
		return uri
	}
	scheme := strings.Index(uri, "://")
	if scheme < 0 {
		return uri
	}
	return uri[:scheme+3] + "***@" + uri[at+1:]
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
