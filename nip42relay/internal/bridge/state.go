package bridge

import (
	"context"
	"database/sql"
	"errors"

	_ "github.com/mattn/go-sqlite3"
)

type StateStore struct {
	db *sql.DB
}

func OpenState(path string) (*StateStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}
	s := &StateStore{db: db}
	if err := s.init(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *StateStore) Close() error                   { return s.db.Close() }
func (s *StateStore) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *StateStore) init(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS bridge_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bridge_github_seen (
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  PRIMARY KEY(repo, branch, sha)
);
CREATE TABLE IF NOT EXISTS bridge_matrix_seen (
  room_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  PRIMARY KEY(room_id, event_id)
);
`)
	return err
}

func (s *StateStore) GetKV(ctx context.Context, key string) (string, bool, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM bridge_kv WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return value, true, nil
}

func (s *StateStore) SetKV(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx, `
INSERT INTO bridge_kv (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, key, value)
	return err
}

func (s *StateStore) HasGitHubSHA(ctx context.Context, repo, branch, sha string) (bool, error) {
	var one int
	err := s.db.QueryRowContext(ctx, `
SELECT 1 FROM bridge_github_seen WHERE repo = ? AND branch = ? AND sha = ?
`, repo, branch, sha).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *StateStore) MarkGitHubSHAs(ctx context.Context, repo, branch string, shas []string) error {
	if len(shas) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
INSERT OR IGNORE INTO bridge_github_seen (repo, branch, sha) VALUES (?, ?, ?)
`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, sha := range shas {
		if _, err := stmt.ExecContext(ctx, repo, branch, sha); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *StateStore) HasMatrixEvent(ctx context.Context, roomID, eventID string) (bool, error) {
	var one int
	err := s.db.QueryRowContext(ctx, `
SELECT 1 FROM bridge_matrix_seen WHERE room_id = ? AND event_id = ?
`, roomID, eventID).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *StateStore) MarkMatrixEvents(ctx context.Context, roomID string, eventIDs []string) error {
	if len(eventIDs) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
INSERT OR IGNORE INTO bridge_matrix_seen (room_id, event_id) VALUES (?, ?)
`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, id := range eventIDs {
		if _, err := stmt.ExecContext(ctx, roomID, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}
