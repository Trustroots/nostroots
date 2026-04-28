package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

const EventKind = 22242

var (
	ErrWrongKind      = errors.New("auth event must be kind 22242")
	ErrBadSignature   = errors.New("auth event signature is invalid")
	ErrWrongChallenge = errors.New("auth event challenge does not match")
	ErrWrongRelay     = errors.New("auth event relay does not match")
	ErrStaleEvent     = errors.New("auth event timestamp is outside allowed age")
)

func NewChallenge() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func Verify(event nostr.Event, challenge, relayURL string, maxAge time.Duration, now time.Time) (string, error) {
	if event.Kind != EventKind {
		return "", ErrWrongKind
	}
	ok, err := event.CheckSignature()
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBadSignature, err)
	}
	if !ok {
		return "", ErrBadSignature
	}
	if tagValue(event.Tags, "challenge") != challenge {
		return "", ErrWrongChallenge
	}
	if tagValue(event.Tags, "relay") != relayURL {
		return "", ErrWrongRelay
	}

	createdAt := event.CreatedAt.Time()
	if createdAt.Before(now.Add(-maxAge)) || createdAt.After(now.Add(maxAge)) {
		return "", ErrStaleEvent
	}

	return event.PubKey, nil
}

func tagValue(tags nostr.Tags, name string) string {
	for _, tag := range tags {
		if len(tag) >= 2 && tag[0] == name {
			return tag[1]
		}
	}
	return ""
}
