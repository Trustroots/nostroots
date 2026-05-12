package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

const (
	kvGitHubLastPollAt = "github.last_poll_at"
	kvMatrixSince      = "matrix.sync_since"
)

type Service struct {
	cfg       Config
	state     *StateStore
	github    *GitHubClient
	matrix    *MatrixClient
	publisher *NostrPublisher

	matrixRoomID string
	matrixSelfID string

	healthMu        sync.RWMutex
	lastGitHubRun   time.Time
	lastGitHubError string
	lastMatrixRun   time.Time
	lastMatrixError string
}

func NewService(cfg Config) (*Service, error) {
	state, err := OpenState(cfg.StatePath)
	if err != nil {
		return nil, err
	}

	s := &Service{
		cfg:       cfg,
		state:     state,
		github:    NewGitHubClient(cfg.GitHubToken),
		matrix:    NewMatrixClient(cfg.MatrixHomeserver, cfg.MatrixAccessToken),
		publisher: NewNostrPublisher(cfg.TargetRelayURL, cfg.AuthRelayURL, cfg.NostrSecretHex),
	}
	return s, nil
}

func (s *Service) Close() error {
	if s.state != nil {
		return s.state.Close()
	}
	return nil
}

func (s *Service) Run(ctx context.Context) error {
	defer s.Close()

	if err := s.preflight(ctx); err != nil {
		return err
	}

	healthServer := &http.Server{Addr: s.cfg.HealthListenAddr, Handler: s.healthMux()}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = healthServer.Shutdown(shutdownCtx)
	}()
	go func() {
		if err := healthServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("nostr-ingestor health server error: %v", err)
		}
	}()

	s.runGitHubLoop(ctx)
	s.runMatrixLoop(ctx)

	<-ctx.Done()
	return nil
}

func (s *Service) preflight(ctx context.Context) error {
	probeCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	if err := s.state.Ping(probeCtx); err != nil {
		return fmt.Errorf("state db preflight failed: %w", err)
	}
	if err := s.publisher.AuthProbe(probeCtx); err != nil {
		return fmt.Errorf("relay auth preflight failed: %w", err)
	}

	roomID, err := s.matrix.ResolveRoomID(probeCtx, MatrixRoomAlias)
	if err != nil {
		return fmt.Errorf("matrix room resolve failed: %w", err)
	}
	s.matrixRoomID = roomID

	selfID, err := s.matrix.WhoAmI(probeCtx)
	if err != nil {
		return fmt.Errorf("matrix whoami failed: %w", err)
	}
	s.matrixSelfID = selfID

	since, ok, err := s.state.GetKV(probeCtx, kvMatrixSince)
	if err != nil {
		return fmt.Errorf("matrix state read failed: %w", err)
	}
	if !ok || since == "" {
		result, err := s.matrix.SyncRoomMessages(probeCtx, s.matrixRoomID, "")
		if err != nil {
			return fmt.Errorf("matrix baseline sync failed: %w", err)
		}
		if err := s.state.SetKV(probeCtx, kvMatrixSince, result.NextBatch); err != nil {
			return fmt.Errorf("matrix baseline token save failed: %w", err)
		}
	}

	log.Printf("nostr-ingestor preflight complete: room=%s self=%s targetRelay=%s authRelayTag=%s", s.matrixRoomID, s.matrixSelfID, s.cfg.TargetRelayURL, s.cfg.AuthRelayURL)
	return nil
}

func (s *Service) runGitHubLoop(ctx context.Context) {
	go func() {
		s.runGitHubOnce(ctx)
		ticker := time.NewTicker(GithubInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.runGitHubOnce(ctx)
			}
		}
	}()
}

func (s *Service) runMatrixLoop(ctx context.Context) {
	go func() {
		s.runMatrixOnce(ctx)
		ticker := time.NewTicker(MatrixInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.runMatrixOnce(ctx)
			}
		}
	}()
}

func (s *Service) runGitHubOnce(ctx context.Context) {
	runAt := time.Now().UTC()
	runCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	since := runAt.Add(-GithubLookback)
	if raw, ok, err := s.state.GetKV(runCtx, kvGitHubLastPollAt); err == nil && ok && raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			since = parsed
		}
	}

	commits, err := s.github.ListCommits(runCtx, since)
	if err != nil {
		s.setGitHubStatus(runAt, err)
		log.Printf("nostr-ingestor github poll failed: %v", err)
		return
	}

	newCommits := make([]GitHubCommit, 0, len(commits))
	for _, c := range commits {
		seen, err := s.state.HasGitHubSHA(runCtx, GithubRepoOwner+"/"+GithubRepoName, GithubBranch, c.SHA)
		if err != nil {
			s.setGitHubStatus(runAt, err)
			log.Printf("nostr-ingestor github dedupe check failed: %v", err)
			return
		}
		if !seen {
			newCommits = append(newCommits, c)
		}
	}

	if len(newCommits) > 0 {
		note := FormatGitHubSummary(newCommits)
		if err := s.publisher.Publish(runCtx, note); err != nil {
			s.setGitHubStatus(runAt, err)
			log.Printf("nostr-ingestor github publish failed: %v", err)
			return
		}
		shas := make([]string, 0, len(newCommits))
		for _, c := range newCommits {
			shas = append(shas, c.SHA)
		}
		if err := s.state.MarkGitHubSHAs(runCtx, GithubRepoOwner+"/"+GithubRepoName, GithubBranch, shas); err != nil {
			s.setGitHubStatus(runAt, err)
			log.Printf("nostr-ingestor github state write failed: %v", err)
			return
		}
	}

	if err := s.state.SetKV(runCtx, kvGitHubLastPollAt, runAt.Format(time.RFC3339)); err != nil {
		s.setGitHubStatus(runAt, err)
		log.Printf("nostr-ingestor github last poll save failed: %v", err)
		return
	}

	s.setGitHubStatus(runAt, nil)
	if len(newCommits) > 0 {
		log.Printf("nostr-ingestor github: posted %d new commits", len(newCommits))
	}
}

func (s *Service) runMatrixOnce(ctx context.Context) {
	runAt := time.Now().UTC()
	runCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	since, ok, err := s.state.GetKV(runCtx, kvMatrixSince)
	if err != nil {
		s.setMatrixStatus(runAt, err)
		log.Printf("nostr-ingestor matrix read state failed: %v", err)
		return
	}
	if !ok {
		since = ""
	}

	result, err := s.matrix.SyncRoomMessages(runCtx, s.matrixRoomID, since)
	if err != nil {
		s.setMatrixStatus(runAt, err)
		log.Printf("nostr-ingestor matrix sync failed: %v", err)
		return
	}

	for _, msg := range result.Messages {
		if msg.Sender == s.matrixSelfID {
			continue
		}
		seen, err := s.state.HasMatrixEvent(runCtx, s.matrixRoomID, msg.EventID)
		if err != nil {
			s.setMatrixStatus(runAt, err)
			log.Printf("nostr-ingestor matrix dedupe check failed: %v", err)
			return
		}
		if seen {
			continue
		}

		note := FormatMatrixNote(msg, MatrixRoomAlias)
		if err := s.publisher.Publish(runCtx, note); err != nil {
			s.setMatrixStatus(runAt, err)
			log.Printf("nostr-ingestor matrix publish failed: %v", err)
			return
		}
		if err := s.state.MarkMatrixEvents(runCtx, s.matrixRoomID, []string{msg.EventID}); err != nil {
			s.setMatrixStatus(runAt, err)
			log.Printf("nostr-ingestor matrix state write failed: %v", err)
			return
		}
	}

	if err := s.state.SetKV(runCtx, kvMatrixSince, result.NextBatch); err != nil {
		s.setMatrixStatus(runAt, err)
		log.Printf("nostr-ingestor matrix token save failed: %v", err)
		return
	}

	s.setMatrixStatus(runAt, nil)
}

func (s *Service) healthMux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		stateOK := s.state.Ping(ctx) == nil

		s.healthMu.RLock()
		lastGitHubRun := s.lastGitHubRun
		lastGitHubError := s.lastGitHubError
		lastMatrixRun := s.lastMatrixRun
		lastMatrixError := s.lastMatrixError
		s.healthMu.RUnlock()

		status := http.StatusOK
		if !stateOK {
			status = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"state": map[string]any{
				"ok": stateOK,
			},
			"github": map[string]any{
				"last_run":   lastGitHubRun,
				"last_error": lastGitHubError,
			},
			"matrix": map[string]any{
				"last_run":   lastMatrixRun,
				"last_error": lastMatrixError,
			},
		})
	})
	return mux
}

func (s *Service) setGitHubStatus(t time.Time, err error) {
	s.healthMu.Lock()
	defer s.healthMu.Unlock()
	s.lastGitHubRun = t
	if err != nil {
		s.lastGitHubError = err.Error()
	} else {
		s.lastGitHubError = ""
	}
}

func (s *Service) setMatrixStatus(t time.Time, err error) {
	s.healthMu.Lock()
	defer s.healthMu.Unlock()
	s.lastMatrixRun = t
	if err != nil {
		s.lastMatrixError = err.Error()
	} else {
		s.lastMatrixError = ""
	}
}
