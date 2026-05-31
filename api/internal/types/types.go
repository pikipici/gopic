package types

type SeriesType string
type SeriesStatus string
type ContentRating string
type Demographic string

const (
	SeriesTypeManga  SeriesType = "manga"
	SeriesTypeManhwa SeriesType = "manhwa"
	SeriesTypeManhua SeriesType = "manhua"
	SeriesTypeComic  SeriesType = "comic"

	SeriesStatusOngoing   SeriesStatus = "ongoing"
	SeriesStatusCompleted SeriesStatus = "completed"
	SeriesStatusHiatus    SeriesStatus = "hiatus"

	ContentRatingAll    ContentRating = "all"
	ContentRatingTeen   ContentRating = "teen"
	ContentRatingMature ContentRating = "mature"

	DemographicShounen Demographic = "shounen"
	DemographicShoujo  Demographic = "shoujo"
	DemographicSeinen  Demographic = "seinen"
	DemographicJosei   Demographic = "josei"
	DemographicGeneral Demographic = "general"
)

type ChapterPage struct {
	PageNumber int    `json:"pageNumber"`
	ImageURL   string `json:"imageUrl"`
	Width      int    `json:"width,omitempty"`
	Height     int    `json:"height,omitempty"`
}

type Chapter struct {
	Slug            string        `json:"slug"`
	NumberLabel     string        `json:"numberLabel"`
	NumberSort      float64       `json:"numberSort"`
	Title           string        `json:"title"`
	PublishedAt     string        `json:"publishedAt"`
	SourceChapterID string        `json:"sourceChapterId,omitempty"`
	Pages           []ChapterPage `json:"pages,omitempty"`
}

type ChapterSummary struct {
	Slug        string  `json:"slug"`
	NumberLabel string  `json:"numberLabel"`
	NumberSort  float64 `json:"numberSort"`
	Title       string  `json:"title"`
	PublishedAt string  `json:"publishedAt"`
	PageCount   int     `json:"pageCount"`
}

type Series struct {
	Slug           string        `json:"slug"`
	Title          string        `json:"title"`
	AltTitles      []string      `json:"altTitles"`
	Synopsis       string        `json:"synopsis"`
	CoverURL       string        `json:"coverUrl"`
	Type           SeriesType    `json:"type"`
	Status         SeriesStatus  `json:"status"`
	ContentRating  ContentRating `json:"contentRating"`
	Demographic    Demographic   `json:"demographic"`
	AuthorName     string        `json:"authorName"`
	ArtistName     string        `json:"artistName"`
	ReleaseYear    int           `json:"releaseYear"`
	Genres         []string      `json:"genres"`
	Chapters       []Chapter     `json:"chapters,omitempty"`
	Featured       bool          `json:"featured"`
	UpdatedAt      string        `json:"updatedAt"`
	SourceID       string        `json:"sourceId,omitempty"`
	SourceSeriesID string        `json:"sourceSeriesId,omitempty"`
	SourceURL      string        `json:"sourceUrl,omitempty"`
	LastSyncedAt   string        `json:"lastSyncedAt,omitempty"`
}

type SeriesSummary struct {
	Slug           string          `json:"slug"`
	Title          string          `json:"title"`
	AltTitles      []string        `json:"altTitles"`
	Synopsis       string          `json:"synopsis"`
	CoverURL       string          `json:"coverUrl"`
	Type           SeriesType      `json:"type"`
	Status         SeriesStatus    `json:"status"`
	ContentRating  ContentRating   `json:"contentRating"`
	Demographic    Demographic     `json:"demographic"`
	AuthorName     string          `json:"authorName"`
	ArtistName     string          `json:"artistName"`
	ReleaseYear    int             `json:"releaseYear"`
	Genres         []string        `json:"genres"`
	ChapterCount   int             `json:"chapterCount"`
	LatestChapter  *ChapterSummary `json:"latestChapter,omitempty"`
	Featured       bool            `json:"featured"`
	UpdatedAt      string          `json:"updatedAt"`
	SourceID       string          `json:"sourceId,omitempty"`
	SourceSeriesID string          `json:"sourceSeriesId,omitempty"`
	SourceURL      string          `json:"sourceUrl,omitempty"`
	LastSyncedAt   string          `json:"lastSyncedAt,omitempty"`
}

type SeriesDetail struct {
	SeriesSummary
	Chapters []ChapterSummary `json:"chapters"`
}

type ChapterReader struct {
	Series struct {
		Slug  string `json:"slug"`
		Title string `json:"title"`
	} `json:"series"`
	Chapter Chapter `json:"chapter"`
}

type AdminLoginRequest struct {
	Token string `json:"token"`
}

type AdminLoginResponse struct {
	Token string `json:"token"`
}

type SeriesInput struct {
	Slug           string        `json:"slug"`
	Title          string        `json:"title"`
	AltTitles      []string      `json:"altTitles"`
	Synopsis       string        `json:"synopsis"`
	CoverURL       string        `json:"coverUrl"`
	Type           SeriesType    `json:"type"`
	Status         SeriesStatus  `json:"status"`
	ContentRating  ContentRating `json:"contentRating"`
	Demographic    Demographic   `json:"demographic"`
	AuthorName     string        `json:"authorName"`
	ArtistName     string        `json:"artistName"`
	ReleaseYear    int           `json:"releaseYear"`
	Genres         []string      `json:"genres"`
	Featured       bool          `json:"featured"`
	SourceID       string        `json:"sourceId,omitempty"`
	SourceSeriesID string        `json:"sourceSeriesId,omitempty"`
	SourceURL      string        `json:"sourceUrl,omitempty"`
}

type ChapterInput struct {
	Slug            string  `json:"slug"`
	NumberLabel     string  `json:"numberLabel"`
	NumberSort      float64 `json:"numberSort"`
	Title           string  `json:"title"`
	PublishedAt     string  `json:"publishedAt"`
	SourceChapterID string  `json:"sourceChapterId,omitempty"`
}

type ChapterPagesInput struct {
	Pages []ChapterPage `json:"pages"`
}
