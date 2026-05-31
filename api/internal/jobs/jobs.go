package jobs

import (
	"context"
	"sort"
	"sync"
	"time"
)

type Status string

const (
	StatusQueued    Status = "queued"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
)

type Job struct {
	ID          string         `json:"id"`
	Type        string         `json:"type"`
	Status      Status         `json:"status"`
	Message     string         `json:"message"`
	Progress    int            `json:"progress"`
	Payload     map[string]any `json:"payload,omitempty"`
	CreatedAt   string         `json:"createdAt"`
	UpdatedAt   string         `json:"updatedAt"`
	CompletedAt string         `json:"completedAt,omitempty"`
}

type Store interface {
	Create(ctx context.Context, kind, message string, payload map[string]any) (Job, error)
	Get(ctx context.Context, id string) (Job, bool, error)
	List(ctx context.Context, limit int) ([]Job, error)
	Update(ctx context.Context, id string, status Status, progress int, message string) (Job, bool, error)
	Prune(ctx context.Context, olderThan time.Duration) (int, error)
}

type MemoryStore struct {
	mu   sync.RWMutex
	seq  int64
	jobs map[string]Job
}

func NewStore() *MemoryStore {
	return &MemoryStore{jobs: map[string]Job{}}
}

func (s *MemoryStore) Create(ctx context.Context, kind, message string, payload map[string]any) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	now := time.Now().UTC().Format(time.RFC3339)
	job := Job{ID: "job-" + time.Now().UTC().Format("20060102150405") + "-" + itoa(s.seq), Type: kind, Status: StatusQueued, Message: message, Progress: 0, Payload: payload, CreatedAt: now, UpdatedAt: now}
	s.jobs[job.ID] = job
	return job, nil
}

func (s *MemoryStore) Get(ctx context.Context, id string) (Job, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	job, ok := s.jobs[id]
	return job, ok, nil
}

func (s *MemoryStore) List(ctx context.Context, limit int) ([]Job, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	items := make([]Job, 0, len(s.jobs))
	for _, job := range s.jobs {
		items = append(items, job)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedAt > items[j].UpdatedAt
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

func (s *MemoryStore) Update(ctx context.Context, id string, status Status, progress int, message string) (Job, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	job, ok := s.jobs[id]
	if !ok {
		return Job{}, false, nil
	}
	job.Status = status
	job.Progress = progress
	job.Message = message
	job.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if status == StatusCompleted || status == StatusFailed {
		job.CompletedAt = job.UpdatedAt
	}
	s.jobs[id] = job
	return job, true, nil
}

func (s *MemoryStore) Prune(ctx context.Context, olderThan time.Duration) (int, error) {
	if olderThan <= 0 {
		return 0, nil
	}
	cutoff := time.Now().UTC().Add(-olderThan).Format(time.RFC3339)
	s.mu.Lock()
	defer s.mu.Unlock()
	removed := 0
	for id, job := range s.jobs {
		if job.Status != StatusCompleted && job.Status != StatusFailed {
			continue
		}
		stamp := job.CompletedAt
		if stamp == "" {
			stamp = job.UpdatedAt
		}
		if stamp != "" && stamp < cutoff {
			delete(s.jobs, id)
			removed++
		}
	}
	return removed, nil
}

func itoa(v int64) string {
	if v == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}
