package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	Addr            string
	DatabaseURL     string
	UseSeed         bool
	AdminToken      string
	UploadDir       string
	SourceID        string
	SourceName      string
	SourceURL       string
	SourceHeaders   map[string]string
	ImageHeaders    map[string]string
	CleanupInterval time.Duration
	JobRetention    time.Duration
	CacheTTL        time.Duration
}

func Load() Config {
	cfg := Config{
		Addr:        ":8080",
		DatabaseURL: os.Getenv("DATABASE_URL"),
		UseSeed:     os.Getenv("DATABASE_URL") == "",
		AdminToken:  os.Getenv("ADMIN_TOKEN"),
		UploadDir:   "./uploads",
	}
	if value := os.Getenv("ADDR"); value != "" {
		cfg.Addr = value
	}
	if value := os.Getenv("GOMIC_USE_SEED"); value == "1" || value == "true" {
		cfg.UseSeed = true
	}
	if value := os.Getenv("UPLOAD_DIR"); value != "" {
		cfg.UploadDir = value
	}
	cfg.SourceID = os.Getenv("SOURCE_ID")
	cfg.SourceName = os.Getenv("SOURCE_NAME")
	cfg.SourceURL = os.Getenv("SOURCE_URL")
	cfg.SourceHeaders = parseHeaders(os.Getenv("SOURCE_HEADERS"))
	cfg.ImageHeaders = parseHeaders(os.Getenv("IMAGE_HEADERS"))
	cfg.CleanupInterval = parseDuration(os.Getenv("CLEANUP_INTERVAL"), time.Hour)
	cfg.JobRetention = parseDuration(os.Getenv("JOB_RETENTION"), 7*24*time.Hour)
	cfg.CacheTTL = parseDuration(os.Getenv("CACHE_TTL"), 30*24*time.Hour)
	return cfg
}

func parseDuration(value string, fallback time.Duration) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	if value == "0" {
		return 0
	}
	if duration, err := time.ParseDuration(value); err == nil {
		return duration
	}
	return fallback
}

func parseHeaders(value string) map[string]string {
	items := map[string]string{}
	for _, line := range strings.FieldsFunc(value, func(char rune) bool { return char == '\n' || char == '|' }) {
		key, headerValue, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		headerValue = strings.TrimSpace(headerValue)
		if key == "" || headerValue == "" {
			continue
		}
		items[key] = headerValue
	}
	if len(items) == 0 {
		return nil
	}
	return items
}
