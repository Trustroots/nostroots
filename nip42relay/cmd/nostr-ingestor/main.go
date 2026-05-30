package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/trustroots/nostroots/nip42relay/internal/bridge"
)

func main() {
	cfg, err := bridge.LoadConfigFromEnv()
	if err != nil {
		var missing *bridge.MissingEnvError
		if errors.As(err, &missing) {
			fmt.Fprintln(os.Stderr, err.Error())
			os.Exit(1)
		}
		log.Fatal(err)
	}

	svc, err := bridge.NewService(cfg)
	if err != nil {
		log.Fatal(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Printf("nostr-ingestor starting: github=%s/%s@%s matrix=%s targetRelay=%s", bridge.GithubRepoOwner, bridge.GithubRepoName, bridge.GithubBranch, bridge.MatrixRoomAlias, cfg.TargetRelayURL)
	if err := svc.Run(ctx); err != nil {
		log.Fatal(err)
	}
	log.Printf("nostr-ingestor stopped")
}
