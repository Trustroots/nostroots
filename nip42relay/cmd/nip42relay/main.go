package main

import (
	"log"
	"net/http"

	"github.com/trustroots/nostroots/nip42relay/internal/config"
	"github.com/trustroots/nostroots/nip42relay/internal/nip05"
	"github.com/trustroots/nostroots/nip42relay/internal/relay"
	"github.com/trustroots/nostroots/nip42relay/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	cache, err := store.Open(cfg.AuthCachePath)
	if err != nil {
		log.Fatal(err)
	}
	defer cache.Close()

	server := &relay.Server{
		PublicRelayURL:  cfg.PublicRelayURL,
		Upstream:        relay.Upstream{URL: cfg.UpstreamRelayURL, Lookup: cfg.UpstreamTimeout},
		Cache:           cache,
		NIP05:           nip05.Client{BaseURL: cfg.TrustrootsNIP05Base},
		AuthCacheTTL:    cfg.AuthCacheTTL,
		AuthEventMaxAge: cfg.AuthEventMaxAge,
	}

	log.Printf("nip42relay listening on %s, upstream %s", cfg.ListenAddr, cfg.UpstreamRelayURL)
	if err := http.ListenAndServe(cfg.ListenAddr, server); err != nil {
		log.Fatal(err)
	}
}
