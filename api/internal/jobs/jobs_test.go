package jobs

import (
	"context"
	"testing"
	"time"
)

func TestMemoryStorePruneRemovesOldFinishedJobs(t *testing.T) {
	store := NewStore()
	ctx := context.Background()
	job, err := store.Create(ctx, "source_import", "queued", nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, _, err := store.Update(ctx, job.ID, StatusCompleted, 100, "done"); err != nil {
		t.Fatalf("update: %v", err)
	}
	store.jobs[job.ID] = func() Job {
		updated := store.jobs[job.ID]
		past := time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339)
		updated.UpdatedAt = past
		updated.CompletedAt = past
		return updated
	}()

	removed, err := store.Prune(ctx, time.Hour)
	if err != nil {
		t.Fatalf("prune: %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 pruned job, got %d", removed)
	}
	if _, ok, _ := store.Get(ctx, job.ID); ok {
		t.Fatalf("expected job %s removed", job.ID)
	}
}

func TestMemoryStorePruneKeepsRunningJobs(t *testing.T) {
	store := NewStore()
	ctx := context.Background()
	job, _ := store.Create(ctx, "source_import", "queued", nil)
	if _, _, err := store.Update(ctx, job.ID, StatusRunning, 50, "halfway"); err != nil {
		t.Fatalf("update: %v", err)
	}
	store.jobs[job.ID] = func() Job {
		updated := store.jobs[job.ID]
		updated.UpdatedAt = time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339)
		return updated
	}()
	removed, err := store.Prune(ctx, time.Hour)
	if err != nil {
		t.Fatalf("prune: %v", err)
	}
	if removed != 0 {
		t.Fatalf("expected running job to remain, removed %d", removed)
	}
}
