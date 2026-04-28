package main

import (
	"flag"
	"os"
	"strconv"
)

type Config struct {
	MongoURI  string
	NostrSK   string
	Output    string
	StateFile string
	Limit     int64
	LogEvery  int
}

func loadConfig(args []string) Config {
	fs := flag.NewFlagSet("trustrootsimporttool", flag.ExitOnError)

	cfg := Config{}
	fs.StringVar(&cfg.MongoURI, "mongo-uri", envString("MONGO_URI", "mongodb://localhost:27017/trustroots"), "MongoDB URI for the imported Trustroots database")
	fs.StringVar(&cfg.NostrSK, "nostr-sk-hex", envString("NOSTR_SK_HEX", ""), "64-character hex Nostr private key used to sign exported events")
	fs.StringVar(&cfg.Output, "output", envString("OUTPUT", "trustroots-hosts.jsonl"), "JSONL output path")
	fs.StringVar(&cfg.StateFile, "state-file", envString("STATE_FILE", ".trustrootsimporttool-state.json"), "JSON state file path")
	fs.Int64Var(&cfg.Limit, "limit", envInt64("LIMIT", 0), "maximum number of eligible hosts to export; 0 means no limit")
	fs.IntVar(&cfg.LogEvery, "log-every", envInt("LOG_EVERY", 1000), "progress log interval")

	_ = fs.Parse(args)
	return cfg
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
