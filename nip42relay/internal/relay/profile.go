package relay

import (
	"encoding/json"
	"strings"

	"github.com/nbd-wtf/go-nostr"
)

const (
	TrustrootsProfileKind              = 10390
	TrustrootsUsernameLabelNamespace   = "org.trustroots:username"
	TrustrootsUsernameMinimumRuneCount = 3
)

func TrustrootsUsernameFromEvent(event nostr.Event) (string, bool) {
	if event.Kind == TrustrootsProfileKind {
		for _, tag := range event.Tags {
			if len(tag) >= 3 && tag[0] == "l" && tag[2] == TrustrootsUsernameLabelNamespace {
				return normalizeUsername(tag[1])
			}
		}
	}

	if event.Kind == 0 {
		var profile struct {
			TrustrootsUsername string `json:"trustrootsUsername"`
			NIP05              string `json:"nip05"`
		}
		if err := json.Unmarshal([]byte(event.Content), &profile); err != nil {
			return "", false
		}
		if username, ok := normalizeUsername(profile.TrustrootsUsername); ok {
			return username, true
		}
		if strings.HasSuffix(strings.ToLower(profile.NIP05), "@trustroots.org") {
			return normalizeUsername(strings.TrimSuffix(strings.ToLower(profile.NIP05), "@trustroots.org"))
		}
	}

	return "", false
}

func normalizeUsername(username string) (string, bool) {
	username = strings.ToLower(strings.TrimSpace(username))
	if len([]rune(username)) < TrustrootsUsernameMinimumRuneCount {
		return "", false
	}
	return username, true
}
