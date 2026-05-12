package bridge

import (
	"fmt"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/nbd-wtf/go-nostr/nip19"
)

const (
	DefaultStatePath        = "/data/bridge-state.db"
	DefaultMatrixHomeserver = "https://matrix.org"
	DefaultTargetRelayURL   = "ws://nip42relay:8042"

	GithubRepoOwner = "Trustroots"
	GithubRepoName  = "nostroots"
	GithubBranch    = "main"
	GithubInterval  = time.Hour
	GithubLookback  = 24 * time.Hour

	MatrixRoomAlias = "#nostroots:matrix.org"
	MatrixInterval  = 5 * time.Minute

	TargetChannelSlug = "nostrootsdev"
	HealthListenAddr  = ":8043"
)

type Config struct {
	NostrSecretHex    string
	GitHubToken       string
	MatrixAccessToken string
	MatrixHomeserver  string
	TargetRelayURL    string
	AuthRelayURL      string
	StatePath         string
	HealthListenAddr  string
}

type MissingEnvError struct {
	Missing []string
}

func (e *MissingEnvError) Error() string {
	return BuildStartupGuidance(e.Missing)
}

func LoadConfigFromEnv() (Config, error) {
	missing := make([]string, 0, 3)
	nsec := strings.TrimSpace(os.Getenv("NSEC"))
	gh := strings.TrimSpace(os.Getenv("GITHUB_TOKEN"))
	mx := strings.TrimSpace(os.Getenv("MATRIX_ACCESS_TOKEN"))

	if nsec == "" {
		missing = append(missing, "NSEC")
	}
	if gh == "" {
		missing = append(missing, "GITHUB_TOKEN")
	}
	if mx == "" {
		missing = append(missing, "MATRIX_ACCESS_TOKEN")
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return Config{}, &MissingEnvError{Missing: missing}
	}

	hexSK, err := decodeNSEC(nsec)
	if err != nil {
		return Config{}, fmt.Errorf("invalid NSEC: %w", err)
	}

	cfg := Config{
		NostrSecretHex:    hexSK,
		GitHubToken:       gh,
		MatrixAccessToken: mx,
		MatrixHomeserver:  strings.TrimRight(env("BRIDGE_MATRIX_HOMESERVER", DefaultMatrixHomeserver), "/"),
		TargetRelayURL:    env("BRIDGE_TARGET_RELAY_URL", DefaultTargetRelayURL),
		StatePath:         env("BRIDGE_STATE_PATH", DefaultStatePath),
		HealthListenAddr:  HealthListenAddr,
	}

	cfg.AuthRelayURL = strings.TrimSpace(os.Getenv("PUBLIC_RELAY_URL"))
	if cfg.AuthRelayURL == "" {
		cfg.AuthRelayURL = cfg.TargetRelayURL
	}

	if err := validateConfig(cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func validateConfig(cfg Config) error {
	if cfg.StatePath == "" {
		return fmt.Errorf("BRIDGE_STATE_PATH must not be empty")
	}
	if cfg.MatrixHomeserver == "" {
		return fmt.Errorf("BRIDGE_MATRIX_HOMESERVER must not be empty")
	}
	mu, err := url.Parse(cfg.MatrixHomeserver)
	if err != nil || (mu.Scheme != "https" && mu.Scheme != "http") {
		return fmt.Errorf("BRIDGE_MATRIX_HOMESERVER must be http:// or https://")
	}
	if mu.Host == "" {
		return fmt.Errorf("BRIDGE_MATRIX_HOMESERVER host is missing")
	}

	for name, raw := range map[string]string{
		"BRIDGE_TARGET_RELAY_URL": cfg.TargetRelayURL,
		"PUBLIC_RELAY_URL":        cfg.AuthRelayURL,
	} {
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "ws" && u.Scheme != "wss") || u.Host == "" {
			return fmt.Errorf("%s must be ws:// or wss:// URL", name)
		}
	}
	return nil
}

func BuildStartupGuidance(missing []string) string {
	want := map[string]bool{}
	for _, k := range missing {
		want[k] = true
	}

	sections := []string{
		"nostr-ingestor startup blocked: missing required environment variables.",
		"",
		fmt.Sprintf("Missing: %s", strings.Join(sortedKeys(want), ", ")),
		"",
		"Set the missing variable(s) and restart the service.",
	}

	if want["NSEC"] {
		sections = append(sections,
			"",
			"NSEC setup:",
			"- Use an existing nsec1... key that is already authorized by nip42relay.",
			"- Export it as: NSEC=nsec1...",
		)
	}
	if want["GITHUB_TOKEN"] {
		sections = append(sections,
			"",
			"GITHUB_TOKEN setup:",
			"- GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens.",
			"- Repository access: Trustroots/nostroots.",
			"- Permission: Contents (Read).",
			"- Export it as: GITHUB_TOKEN=...",
		)
	}
	if want["MATRIX_ACCESS_TOKEN"] {
		sections = append(sections,
			"",
			"MATRIX_ACCESS_TOKEN setup:",
			"- Element: Settings -> Help & About -> Your Access Token.",
			"- Or call Matrix login API: POST /_matrix/client/v3/login and use returned access_token.",
			"- Export it as: MATRIX_ACCESS_TOKEN=...",
		)
	}

	sections = append(sections,
		"",
		"Optional vars:",
		fmt.Sprintf("- BRIDGE_STATE_PATH (default: %s)", DefaultStatePath),
		fmt.Sprintf("- BRIDGE_MATRIX_HOMESERVER (default: %s)", DefaultMatrixHomeserver),
		fmt.Sprintf("- BRIDGE_TARGET_RELAY_URL (default: %s)", DefaultTargetRelayURL),
	)

	return strings.Join(sections, "\n")
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func decodeNSEC(value string) (string, error) {
	prefix, decoded, err := nip19.Decode(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}
	if prefix != "nsec" {
		return "", fmt.Errorf("must start with nsec1")
	}
	hex, ok := decoded.(string)
	if !ok || len(hex) != 64 {
		return "", fmt.Errorf("decoded nsec payload must be 64-char hex")
	}
	return hex, nil
}
