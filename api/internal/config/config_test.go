package config

import "testing"

func TestLoadSourcesJSONAndLegacySource(t *testing.T) {
	t.Setenv("SOURCES_JSON", `[{"id":"komikcast","name":"Komik Cast","url":"http://localhost:19190"},{"id":"komikindo","name":"KomikIndo","url":"http://localhost:19191","headers":{"X-Test":"ok"}}]`)
	t.Setenv("SOURCE_ID", "legacy")
	t.Setenv("SOURCE_NAME", "Legacy Source")
	t.Setenv("SOURCE_URL", "http://localhost:19192")

	cfg := Load()
	if len(cfg.Sources) != 3 {
		t.Fatalf("expected 3 sources, got %d", len(cfg.Sources))
	}
	if cfg.Sources[0].ID != "komikcast" || cfg.Sources[1].ID != "komikindo" || cfg.Sources[2].ID != "legacy" {
		t.Fatalf("unexpected sources: %#v", cfg.Sources)
	}
	if cfg.Sources[1].Headers["X-Test"] != "ok" {
		t.Fatalf("source headers not parsed: %#v", cfg.Sources[1].Headers)
	}
}

func TestLoadIgnoresInvalidSourcesJSON(t *testing.T) {
	t.Setenv("SOURCES_JSON", `not-json`)

	cfg := Load()
	if len(cfg.Sources) != 0 {
		t.Fatalf("expected no sources, got %#v", cfg.Sources)
	}
}
