package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestCachePutGetValid(t *testing.T) {
	cache, err := Open(filepath.Join(t.TempDir(), "cache.db"))
	if err != nil {
		t.Fatalf("Open returned error: %v", err)
	}
	defer cache.Close()

	now := time.Unix(1700000000, 0)
	if err := cache.Put(context.Background(), "pubkey", "alice", now, now.Add(time.Hour)); err != nil {
		t.Fatalf("Put returned error: %v", err)
	}

	entry, ok, err := cache.GetValid(context.Background(), "pubkey", now)
	if err != nil {
		t.Fatalf("GetValid returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected cache hit")
	}
	if entry.Username != "alice" {
		t.Fatalf("expected alice, got %s", entry.Username)
	}
}

func TestCacheExpired(t *testing.T) {
	cache, err := Open(filepath.Join(t.TempDir(), "cache.db"))
	if err != nil {
		t.Fatalf("Open returned error: %v", err)
	}
	defer cache.Close()

	now := time.Unix(1700000000, 0)
	if err := cache.Put(context.Background(), "pubkey", "alice", now.Add(-2*time.Hour), now.Add(-time.Hour)); err != nil {
		t.Fatalf("Put returned error: %v", err)
	}

	_, ok, err := cache.GetValid(context.Background(), "pubkey", now)
	if err != nil {
		t.Fatalf("GetValid returned error: %v", err)
	}
	if ok {
		t.Fatal("expected expired cache miss")
	}
}
