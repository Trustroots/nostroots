package relay

import (
	"encoding/json"
	"fmt"
)

func MessageType(message []byte) (string, error) {
	var raw []json.RawMessage
	if err := json.Unmarshal(message, &raw); err != nil {
		return "", err
	}
	if len(raw) == 0 {
		return "", fmt.Errorf("nostr message must be a non-empty array")
	}
	var typ string
	if err := json.Unmarshal(raw[0], &typ); err != nil {
		return "", err
	}
	return typ, nil
}

func EventIDFromMessage(message []byte) string {
	var raw []json.RawMessage
	if err := json.Unmarshal(message, &raw); err != nil || len(raw) < 2 {
		return ""
	}
	var event struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw[1], &event); err != nil {
		return ""
	}
	return event.ID
}

func PubkeyFromEventMessage(message []byte) (string, error) {
	var raw []json.RawMessage
	if err := json.Unmarshal(message, &raw); err != nil {
		return "", err
	}
	if len(raw) < 2 {
		return "", fmt.Errorf("EVENT message is missing event payload")
	}
	var event struct {
		Pubkey string `json:"pubkey"`
	}
	if err := json.Unmarshal(raw[1], &event); err != nil {
		return "", err
	}
	return event.Pubkey, nil
}
