package bridge

import (
	"os"
	"strings"
	"testing"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

func TestLoadConfigFromEnvDefaults(t *testing.T) {
	t.Setenv("GITHUB_TOKEN", "ghp_test")
	t.Setenv("MATRIX_ACCESS_TOKEN", "syt_test")
	t.Setenv("PUBLIC_RELAY_URL", "ws://localhost:8042")

	sk := nostr.GeneratePrivateKey()
	nsec, err := nip19.EncodePrivateKey(sk)
	if err != nil {
		t.Fatalf("EncodePrivateKey: %v", err)
	}
	t.Setenv("NSEC", nsec)

	cfg, err := LoadConfigFromEnv()
	if err != nil {
		t.Fatalf("LoadConfigFromEnv error: %v", err)
	}
	if cfg.StatePath != DefaultStatePath {
		t.Fatalf("StatePath = %s, want %s", cfg.StatePath, DefaultStatePath)
	}
	if cfg.TargetRelayURL != DefaultTargetRelayURL {
		t.Fatalf("TargetRelayURL = %s, want %s", cfg.TargetRelayURL, DefaultTargetRelayURL)
	}
	if cfg.AuthRelayURL != "ws://localhost:8042" {
		t.Fatalf("AuthRelayURL = %s, want ws://localhost:8042", cfg.AuthRelayURL)
	}
	if cfg.NostrSecretHex != sk {
		t.Fatalf("decoded secret mismatch")
	}
}

func TestLoadConfigFromEnvMissingGuidance(t *testing.T) {
	for _, key := range []string{"NSEC", "GITHUB_TOKEN", "MATRIX_ACCESS_TOKEN"} {
		t.Setenv(key, "")
	}

	_, err := LoadConfigFromEnv()
	if err == nil {
		t.Fatal("expected missing env error")
	}
	msg := err.Error()
	for _, mustContain := range []string{
		"missing required environment variables",
		"GITHUB_TOKEN setup",
		"MATRIX_ACCESS_TOKEN setup",
		"NSEC setup",
	} {
		if !strings.Contains(msg, mustContain) {
			t.Fatalf("error missing %q: %s", mustContain, msg)
		}
	}
}

func TestBuildStartupGuidanceSingleMissingIsTargeted(t *testing.T) {
	msg := BuildStartupGuidance([]string{"GITHUB_TOKEN"})
	if !strings.Contains(msg, "GITHUB_TOKEN setup") {
		t.Fatalf("expected github setup guidance")
	}
	if strings.Contains(msg, "MATRIX_ACCESS_TOKEN setup") {
		t.Fatalf("unexpected matrix guidance in single-missing output")
	}
	if strings.Contains(msg, "NSEC setup") {
		t.Fatalf("unexpected nsec guidance in single-missing output")
	}
}

func TestDecodeNSECBadPrefix(t *testing.T) {
	sk := nostr.GeneratePrivateKey()
	npub, err := nip19.EncodePublicKey(mustPub(t, sk))
	if err != nil {
		t.Fatalf("EncodePublicKey: %v", err)
	}
	_, err = decodeNSEC(npub)
	if err == nil {
		t.Fatal("expected decode failure for npub")
	}
}

func mustPub(t *testing.T, sk string) string {
	t.Helper()
	pk, err := nostr.GetPublicKey(sk)
	if err != nil {
		t.Fatalf("GetPublicKey: %v", err)
	}
	return pk
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
