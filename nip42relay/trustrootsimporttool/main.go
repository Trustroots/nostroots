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
	cfg := loadConfig(args)
	if err := validatePrivateKey(cfg.NostrSK); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	previous, err := loadState(cfg.StateFile)
	if err != nil {
		return fmt.Errorf("load state: %w", err)
	}
	records, err := fetchHosts(ctx, cfg.MongoURI, cfg.Limit)
	if err != nil {
		return fmt.Errorf("fetch hosts: %w", err)
	}

	outputFile, err := os.Create(cfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer outputFile.Close()
	writer := bufio.NewWriter(outputFile)
	defer writer.Flush()

	current := State{Offers: map[string]StateEntry{}}
	exported := 0
	for _, record := range records {
		event, err := eventForHost(record, cfg.NostrSK)
		if err != nil {
			return fmt.Errorf("create event for offer %s: %w", record.Offer.ID.Hex(), err)
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
			fmt.Fprintf(os.Stderr, "exported %d hosts\n", exported)
		}
	}

	deleted := 0
	for offerID, entry := range staleEntries(previous, current) {
		event, err := deletionEvent(entry, cfg.NostrSK, time.Now())
		if err != nil {
			return fmt.Errorf("create deletion for offer %s: %w", offerID, err)
		}
		if err := writeJSONLine(writer, event); err != nil {
			return err
		}
		deleted++
	}

	if err := writer.Flush(); err != nil {
		return err
	}
	if err := saveState(cfg.StateFile, current); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	fmt.Fprintf(os.Stderr, "wrote %s: exported=%d deletions=%d state=%s\n", cfg.Output, exported, deleted, cfg.StateFile)
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
