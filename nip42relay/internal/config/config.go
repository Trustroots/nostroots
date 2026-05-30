package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

type Config struct {
	ListenAddr          string
	PublicRelayURL      string
	UpstreamRelayURL    string
	AuthCachePath       string
	TrustrootsNIP05Base string
	AuthCacheTTL        time.Duration
	AuthEventMaxAge     time.Duration
	UpstreamTimeout     time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		ListenAddr:          env("LISTEN_ADDR", ":8042"),
		PublicRelayURL:      env("PUBLIC_RELAY_URL", "ws://localhost:8042"),
		UpstreamRelayURL:    env("UPSTREAM_RELAY_URL", "ws://strfry:5542"),
		AuthCachePath:       env("AUTH_CACHE_PATH", "./auth-cache.db"),
		TrustrootsNIP05Base: env("TRUSTROOTS_NIP05_BASE_URL", "https://www.trustroots.org/.well-known/nostr.json"),
		AuthCacheTTL:        envDuration("AUTH_CACHE_TTL", 24*time.Hour),
		AuthEventMaxAge:     envDuration("AUTH_EVENT_MAX_AGE", 10*time.Minute),
		UpstreamTimeout:     envDuration("UPSTREAM_TIMEOUT", 5*time.Second),
	}

	if _, err := url.ParseRequestURI(cfg.PublicRelayURL); err != nil {
		return Config{}, fmt.Errorf("PUBLIC_RELAY_URL is invalid: %w", err)
	}
	if u, err := url.Parse(cfg.UpstreamRelayURL); err != nil || (u.Scheme != "ws" && u.Scheme != "wss") {
		return Config{}, fmt.Errorf("UPSTREAM_RELAY_URL must be ws:// or wss://")
	}
	if cfg.AuthCacheTTL <= 0 {
		return Config{}, fmt.Errorf("AUTH_CACHE_TTL must be positive")
	}
	if cfg.AuthEventMaxAge <= 0 {
		return Config{}, fmt.Errorf("AUTH_EVENT_MAX_AGE must be positive")
	}

	return cfg, nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	if parsed, err := time.ParseDuration(value); err == nil {
		return parsed
	}
	if seconds, err := strconv.Atoi(value); err == nil {
		return time.Duration(seconds) * time.Second
	}
	return fallback
}
