package main

import (
	"bufio"
	"errors"
	"flag"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/nbd-wtf/go-nostr/nip19"
)

type Config struct {
	MongoURI  string
	NostrSK   string
	Output    string
	StateFile string
	Limit     int64
	LogEvery  int
}

func loadConfig(args []string) (Config, error) {
	loadDotEnvCandidates()

	fs := flag.NewFlagSet("trustrootsimporttool", flag.ExitOnError)

	cfg := Config{}
	fs.StringVar(&cfg.MongoURI, "mongo-uri", envString("MONGO_URI", "mongodb://localhost:27017/trustroots"), "MongoDB URI for the imported Trustroots database")
	nsec := envString("NSEC", "")
	fs.StringVar(&nsec, "nsec", nsec, "NIP-19 nsec private key used to sign exported events")
	fs.StringVar(&cfg.Output, "output", envString("OUTPUT", "trustroots-hosts.jsonl"), "JSONL output path")
	fs.StringVar(&cfg.StateFile, "state-file", envString("STATE_FILE", ".trustrootsimporttool-state.json"), "JSON state file path")
	fs.Int64Var(&cfg.Limit, "limit", envInt64("LIMIT", 0), "maximum host offers to export (offers collection only); 0 = no limit. Does not cap contacts/experiences.")
	fs.IntVar(&cfg.LogEvery, "log-every", envInt("LOG_EVERY", 1000), "progress log interval")

	_ = fs.Parse(args)
	decodedHex, err := decodeNSEC(nsec)
	if err != nil {
		return Config{}, err
	}
	cfg.NostrSK = decodedHex
	return cfg, nil
}

func envString(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt64(name string, fallback int64) int64 {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func loadDotEnvCandidates() {
	candidates := []string{
		".env",
		filepath.Join("trustrootsimporttool", ".env"),
	}
	for _, path := range candidates {
		_ = loadDotEnv(path)
	}
}

func loadDotEnv(path string) error {
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key == "" {
			continue
		}
		if _, alreadySet := os.LookupEnv(key); alreadySet {
			continue
		}
		_ = os.Setenv(key, value)
	}
	return scanner.Err()
}

func decodeNSEC(value string) (string, error) {
	if strings.TrimSpace(value) == "" {
		return "", errors.New("missing private key: set NSEC (nsec1...)")
	}
	prefix, decoded, err := nip19.Decode(value)
	if err != nil {
		return "", err
	}
	if prefix != "nsec" {
		return "", errors.New("NSEC must start with nsec1")
	}
	secret, ok := decoded.(string)
	if !ok {
		return "", errors.New("invalid NSEC payload")
	}
	return secret, nil
}
