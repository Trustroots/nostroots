package bridge

import (
	"context"
	"path/filepath"
	"testing"
)

func TestStateStoreGitHubAndMatrixDedupe(t *testing.T) {
	s, err := OpenState(filepath.Join(t.TempDir(), "bridge.db"))
	if err != nil {
		t.Fatalf("OpenState: %v", err)
	}
	defer s.Close()

	ctx := context.Background()

	seen, err := s.HasGitHubSHA(ctx, "Trustroots/nostroots", "main", "abc")
	if err != nil || seen {
		t.Fatalf("expected unseen github sha")
	}
	if err := s.MarkGitHubSHAs(ctx, "Trustroots/nostroots", "main", []string{"abc", "def"}); err != nil {
		t.Fatalf("MarkGitHubSHAs: %v", err)
	}
	seen, err = s.HasGitHubSHA(ctx, "Trustroots/nostroots", "main", "abc")
	if err != nil || !seen {
		t.Fatalf("expected seen github sha")
	}

	seen, err = s.HasMatrixEvent(ctx, "!room:matrix.org", "$e1")
	if err != nil || seen {
		t.Fatalf("expected unseen matrix event")
	}
	if err := s.MarkMatrixEvents(ctx, "!room:matrix.org", []string{"$e1"}); err != nil {
		t.Fatalf("MarkMatrixEvents: %v", err)
	}
	seen, err = s.HasMatrixEvent(ctx, "!room:matrix.org", "$e1")
	if err != nil || !seen {
		t.Fatalf("expected seen matrix event")
	}
}
