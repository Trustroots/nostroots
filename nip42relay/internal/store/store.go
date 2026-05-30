package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Cache struct {
	db *sql.DB
}

type Entry struct {
	Pubkey    string
	Username  string
	ExpiresAt time.Time
}

func Open(path string) (*Cache, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}
	cache := &Cache{db: db}
	if err := cache.init(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return cache, nil
}

func (c *Cache) Close() error {
	return c.db.Close()
}

func (c *Cache) Ping(ctx context.Context) error {
	return c.db.PingContext(ctx)
}

func (c *Cache) init(ctx context.Context) error {
	_, err := c.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS auth_cache (
	pubkey TEXT PRIMARY KEY,
	username TEXT NOT NULL,
	verified_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_cache_expires_at_idx ON auth_cache(expires_at);
`)
	return err
}

func (c *Cache) GetValid(ctx context.Context, pubkey string, now time.Time) (Entry, bool, error) {
	var entry Entry
	var expires int64
	err := c.db.QueryRowContext(ctx, `
SELECT pubkey, username, expires_at
FROM auth_cache
WHERE pubkey = ? AND expires_at > ?
`, pubkey, now.Unix()).Scan(&entry.Pubkey, &entry.Username, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return Entry{}, false, nil
	}
	if err != nil {
		return Entry{}, false, err
	}
	entry.ExpiresAt = time.Unix(expires, 0)
	return entry, true, nil
}

func (c *Cache) Put(ctx context.Context, pubkey, username string, verifiedAt, expiresAt time.Time) error {
	_, err := c.db.ExecContext(ctx, `
INSERT INTO auth_cache (pubkey, username, verified_at, expires_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(pubkey) DO UPDATE SET
	username = excluded.username,
	verified_at = excluded.verified_at,
	expires_at = excluded.expires_at
`, pubkey, username, verifiedAt.Unix(), expiresAt.Unix())
	return err
}
