package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

type stdinEvent struct {
	Event struct {
		ID string `json:"id"`
	} `json:"event"`
}

func main() {
	url := os.Getenv("PLUGIN_HTTP_URL")
	if url == "" {
		log.Fatal("#fxQ0Fy PLUGIN_HTTP_URL is not set")
	}

	log.Printf("#jHN6QB Forwarding stdin to %s", url)

	client := &http.Client{Timeout: 5 * time.Second}

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB buffer

	for scanner.Scan() {
		line := scanner.Bytes()
		log.Printf("#IKJf6Y Received %d bytes from stdin", len(line))

		// Extract event.id for error fallback responses.
		var parsed stdinEvent
		json.Unmarshal(line, &parsed)
		eventID := parsed.Event.ID

		resp, err := client.Post(url, "application/json", bytes.NewReader(line))
		if err != nil {
			log.Printf("#LnpdBc HTTP request failed: %s", err)
			writeReject(eventID, fmt.Sprintf("error: HTTP request failed: %s", err))
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()

		if err != nil {
			log.Printf("#T89wto Failed to read response body: %s", err)
			writeReject(eventID, fmt.Sprintf("error: failed to read response body: %s", err))
			continue
		}

		if resp.StatusCode != http.StatusOK {
			log.Printf("#SbhERA HTTP %d: %s", resp.StatusCode, string(body))
			writeReject(eventID, fmt.Sprintf("error: HTTP %d", resp.StatusCode))
			continue
		}

		os.Stdout.Write(body)
		os.Stdout.Write([]byte("\n"))
		log.Printf("#ON8Dt9 Forwarded response for event %s", eventID)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("#8n0W2n Error reading from stdin: %s", err)
	}
}

func writeReject(eventID, msg string) {
	response := map[string]string{
		"id":     eventID,
		"action": "reject",
		"msg":    msg,
	}
	out, _ := json.Marshal(response)
	os.Stdout.Write(out)
	os.Stdout.Write([]byte("\n"))
	log.Printf("#kX1OvU Wrote reject for event %s: %s", eventID, msg)
}
