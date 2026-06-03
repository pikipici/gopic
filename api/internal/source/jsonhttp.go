package source

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"gomic-api/internal/types"
)

type JSONHTTPSource struct {
	id      string
	name    string
	baseURL string
	headers map[string]string
	client  *http.Client
}

func NewJSONHTTPSource(id, name, baseURL string) *JSONHTTPSource {
	return NewJSONHTTPSourceWithHeaders(id, name, baseURL, nil)
}

func NewJSONHTTPSourceWithHeaders(id, name, baseURL string, headers map[string]string) *JSONHTTPSource {
	return &JSONHTTPSource{
		id:      strings.TrimSpace(id),
		name:    strings.TrimSpace(name),
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		headers: cleanHeaders(headers),
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *JSONHTTPSource) ID() string {
	if s.id == "" {
		return "json-http"
	}
	return s.id
}

func (s *JSONHTTPSource) Name() string {
	if s.name == "" {
		return "JSON HTTP Source"
	}
	return s.name
}

func (s *JSONHTTPSource) Search(ctx context.Context, query string) ([]SeriesResult, error) {
	var response struct {
		Results []SeriesResult `json:"results"`
	}
	if err := s.get(ctx, "/search?q="+url.QueryEscape(query), &response); err != nil {
		return nil, err
	}
	for index := range response.Results {
		response.Results[index].SourceID = s.ID()
	}
	return response.Results, nil
}

func (s *JSONHTTPSource) Detail(ctx context.Context, id string) (SeriesDetail, error) {
	var detail SeriesDetail
	if err := s.get(ctx, "/series/"+url.PathEscape(id), &detail); err != nil {
		return SeriesDetail{}, err
	}
	detail.SourceID = s.ID()
	if detail.ID == "" {
		detail.ID = id
	}
	return detail, nil
}

func (s *JSONHTTPSource) ImportSeries(ctx context.Context, id string) (SeriesImport, error) {
	var imported SeriesImport
	if err := s.get(ctx, "/series/"+url.PathEscape(id)+"/import", &imported); err != nil {
		return SeriesImport{}, err
	}
	imported.Series.SourceID = s.ID()
	if imported.Series.SourceSeriesID == "" {
		imported.Series.SourceSeriesID = id
	}
	if imported.Series.SourceURL == "" {
		imported.Series.SourceURL = s.baseURL + "/series/" + url.PathEscape(id)
	}
	return imported, nil
}

func (s *JSONHTTPSource) Pages(ctx context.Context, seriesID, chapterSlug string) ([]types.ChapterPage, error) {
	var response struct {
		Pages []types.ChapterPage `json:"pages"`
	}
	path := "/series/" + url.PathEscape(seriesID) + "/chapters/" + url.PathEscape(chapterSlug) + "/pages"
	if err := s.get(ctx, path, &response); err != nil {
		return nil, err
	}
	return response.Pages, nil
}

func (s *JSONHTTPSource) Health(ctx context.Context) error {
	if s.baseURL == "" {
		return fmt.Errorf("json http source base url is not configured")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+"/healthz", nil)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	for key, value := range s.headers {
		request.Header.Set(key, value)
	}
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("json http source health: status %d", response.StatusCode)
	}
	return nil
}

func (s *JSONHTTPSource) get(ctx context.Context, path string, target any) error {
	if s.baseURL == "" {
		return fmt.Errorf("json http source base url is not configured")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+path, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	for key, value := range s.headers {
		request.Header.Set(key, value)
	}
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("json http source %s: status %d", path, response.StatusCode)
	}
	return json.NewDecoder(response.Body).Decode(target)
}
