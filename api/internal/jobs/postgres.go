package jobs

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) Create(ctx context.Context, kind, message string, payload map[string]any) (Job, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return Job{}, err
	}
	var job Job
	var payloadBytes []byte
	err = s.pool.QueryRow(ctx, `
INSERT INTO admin_jobs (type, status, message, progress, payload)
VALUES ($1, $2, $3, 0, $4)
RETURNING id::text, type, status, message, progress, payload, created_at::text, updated_at::text, COALESCE(completed_at::text, '')`, kind, StatusQueued, message, payloadJSON).Scan(
		&job.ID,
		&job.Type,
		&job.Status,
		&job.Message,
		&job.Progress,
		&payloadBytes,
		&job.CreatedAt,
		&job.UpdatedAt,
		&job.CompletedAt,
	)
	if err != nil {
		return Job{}, err
	}
	job.Payload = decodePayload(payloadBytes)
	return job, nil
}

func (s *PostgresStore) Get(ctx context.Context, id string) (Job, bool, error) {
	var job Job
	var payloadBytes []byte
	err := s.pool.QueryRow(ctx, `
SELECT id::text, type, status, message, progress, payload, created_at::text, updated_at::text, COALESCE(completed_at::text, '')
FROM admin_jobs
WHERE id = $1`, id).Scan(
		&job.ID,
		&job.Type,
		&job.Status,
		&job.Message,
		&job.Progress,
		&payloadBytes,
		&job.CreatedAt,
		&job.UpdatedAt,
		&job.CompletedAt,
	)
	if err == pgx.ErrNoRows {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}
	job.Payload = decodePayload(payloadBytes)
	return job, true, nil
}

func (s *PostgresStore) List(ctx context.Context, limit int) ([]Job, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, type, status, message, progress, payload, created_at::text, updated_at::text, COALESCE(completed_at::text, '')
FROM admin_jobs
ORDER BY updated_at DESC
LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Job{}
	for rows.Next() {
		var job Job
		var payloadBytes []byte
		if err := rows.Scan(
			&job.ID,
			&job.Type,
			&job.Status,
			&job.Message,
			&job.Progress,
			&payloadBytes,
			&job.CreatedAt,
			&job.UpdatedAt,
			&job.CompletedAt,
		); err != nil {
			return nil, err
		}
		job.Payload = decodePayload(payloadBytes)
		items = append(items, job)
	}
	return items, rows.Err()
}

func (s *PostgresStore) Update(ctx context.Context, id string, status Status, progress int, message string) (Job, bool, error) {
	var job Job
	var payloadBytes []byte
	err := s.pool.QueryRow(ctx, `
UPDATE admin_jobs
SET status = $2,
    progress = $3,
    message = $4,
    updated_at = now(),
    completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN now() ELSE completed_at END
WHERE id = $1
RETURNING id::text, type, status, message, progress, payload, created_at::text, updated_at::text, COALESCE(completed_at::text, '')`, id, status, progress, message).Scan(
		&job.ID,
		&job.Type,
		&job.Status,
		&job.Message,
		&job.Progress,
		&payloadBytes,
		&job.CreatedAt,
		&job.UpdatedAt,
		&job.CompletedAt,
	)
	if err == pgx.ErrNoRows {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}
	job.Payload = decodePayload(payloadBytes)
	return job, true, nil
}

func (s *PostgresStore) Prune(ctx context.Context, olderThan time.Duration) (int, error) {
	if olderThan <= 0 {
		return 0, nil
	}
	cutoff := time.Now().UTC().Add(-olderThan)
	tag, err := s.pool.Exec(ctx, `
DELETE FROM admin_jobs
WHERE status IN ('completed', 'failed') AND COALESCE(completed_at, updated_at) < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func decodePayload(payloadBytes []byte) map[string]any {
	payload := map[string]any{}
	if len(payloadBytes) == 0 {
		return payload
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return map[string]any{}
	}
	return payload
}

func RecoverRunning(ctx context.Context, store Store) error {
	pgStore, ok := store.(*PostgresStore)
	if !ok {
		return nil
	}
	_, err := pgStore.pool.Exec(ctx, `
UPDATE admin_jobs
SET status = 'failed',
    progress = 100,
    message = 'Job interrupted by API restart',
    updated_at = now(),
    completed_at = now()
WHERE status IN ('queued', 'running') AND updated_at < $1`, time.Now().UTC())
	return err
}
