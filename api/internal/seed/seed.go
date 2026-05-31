package seed

import "gomic-api/internal/types"

func page(seriesSlug, chapterSlug string, pageNumber int) types.ChapterPage {
	return types.ChapterPage{
		PageNumber: pageNumber,
		ImageURL:   "/mock-pages/" + seriesSlug + "-" + chapterSlug + "-" + itoa(pageNumber) + ".svg",
		Width:      900,
		Height:     1280,
	}
}

func pages(seriesSlug, chapterSlug string, total int) []types.ChapterPage {
	items := make([]types.ChapterPage, 0, total)
	for i := 1; i <= total; i++ {
		items = append(items, page(seriesSlug, chapterSlug, i))
	}
	return items
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for value > 0 {
		i--
		buf[i] = byte('0' + value%10)
		value /= 10
	}
	return string(buf[i:])
}

func Series() []types.Series {
	return []types.Series{
		{
			Slug:          "nighthawk-protocol",
			Title:         "Nighthawk Protocol",
			AltTitles:     []string{"Night Hawk", "Protocol Malam"},
			Synopsis:      "Kurir data bawah tanah nemu kunci enkripsi yang bisa membongkar guild korporat paling berbahaya di kota neon.",
			CoverURL:      "/mock-covers/nighthawk.svg",
			Type:          types.SeriesTypeManhwa,
			Status:        types.SeriesStatusOngoing,
			ContentRating: types.ContentRatingTeen,
			Demographic:   types.DemographicSeinen,
			AuthorName:    "Raka Aster",
			ArtistName:    "Mira Void",
			ReleaseYear:   2025,
			Genres:        []string{"Action", "Cyberpunk", "Mystery"},
			Featured:      true,
			UpdatedAt:     "2026-05-29T10:00:00Z",
			Chapters: []types.Chapter{
				{Slug: "chapter-003", NumberLabel: "Chapter 3", NumberSort: 3, Title: "Packet Loss", PublishedAt: "2026-05-29T10:00:00Z", Pages: pages("nighthawk", "003", 4)},
				{Slug: "chapter-002", NumberLabel: "Chapter 2", NumberSort: 2, Title: "Blackbox Alley", PublishedAt: "2026-05-22T10:00:00Z", Pages: pages("nighthawk", "002", 3)},
				{Slug: "chapter-001", NumberLabel: "Chapter 1", NumberSort: 1, Title: "Handshake", PublishedAt: "2026-05-15T10:00:00Z", Pages: pages("nighthawk", "001", 3)},
			},
		},
		{
			Slug:          "saltwater-oracle",
			Title:         "Saltwater Oracle",
			AltTitles:     []string{"Oracle Laut Asin"},
			Synopsis:      "Anak penjaga mercusuar bisa membaca masa depan lewat ombak, tapi tiap ramalan selalu minta tumbal ingatan.",
			CoverURL:      "/mock-covers/saltwater.svg",
			Type:          types.SeriesTypeManga,
			Status:        types.SeriesStatusOngoing,
			ContentRating: types.ContentRatingTeen,
			Demographic:   types.DemographicShoujo,
			AuthorName:    "Kei Maru",
			ArtistName:    "Naya Tide",
			ReleaseYear:   2024,
			Genres:        []string{"Fantasy", "Drama", "Supernatural"},
			Featured:      true,
			UpdatedAt:     "2026-05-28T08:00:00Z",
			Chapters: []types.Chapter{
				{Slug: "chapter-012", NumberLabel: "Chapter 12", NumberSort: 12, Title: "Low Tide Promise", PublishedAt: "2026-05-28T08:00:00Z", Pages: pages("saltwater", "012", 4)},
				{Slug: "chapter-011", NumberLabel: "Chapter 11", NumberSort: 11, Title: "The Bell Below", PublishedAt: "2026-05-21T08:00:00Z", Pages: pages("saltwater", "011", 3)},
			},
		},
		{
			Slug:          "iron-lantern-sect",
			Title:         "Iron Lantern Sect",
			AltTitles:     []string{"Tie Deng Men", "Sekte Lentera Besi"},
			Synopsis:      "Murid paling lemah dari sekte tua dapet lentera retak berisi teknik kultivasi yang dilarang seratus tahun lalu.",
			CoverURL:      "/mock-covers/iron-lantern.svg",
			Type:          types.SeriesTypeManhua,
			Status:        types.SeriesStatusOngoing,
			ContentRating: types.ContentRatingTeen,
			Demographic:   types.DemographicShounen,
			AuthorName:    "Han Qiu",
			ArtistName:    "Lin Forge",
			ReleaseYear:   2023,
			Genres:        []string{"Cultivation", "Adventure", "Martial Arts"},
			UpdatedAt:     "2026-05-26T09:30:00Z",
			Chapters: []types.Chapter{
				{Slug: "chapter-041", NumberLabel: "Chapter 41", NumberSort: 41, Title: "Ashes of the Outer Hall", PublishedAt: "2026-05-26T09:30:00Z", Pages: pages("iron-lantern", "041", 3)},
				{Slug: "chapter-040", NumberLabel: "Chapter 40", NumberSort: 40, Title: "Nine Sparks Trial", PublishedAt: "2026-05-19T09:30:00Z", Pages: pages("iron-lantern", "040", 3)},
			},
		},
		{
			Slug:          "orbit-cafe-after-hours",
			Title:         "Orbit Cafe After Hours",
			AltTitles:     []string{"Kafe Orbit"},
			Synopsis:      "Slice of life tentang kafe kecil di stasiun luar angkasa yang tiap malam didatangi pelanggan dari timeline berbeda.",
			CoverURL:      "/mock-covers/orbit-cafe.svg",
			Type:          types.SeriesTypeComic,
			Status:        types.SeriesStatusCompleted,
			ContentRating: types.ContentRatingAll,
			Demographic:   types.DemographicGeneral,
			AuthorName:    "Dina Pulse",
			ArtistName:    "Sora Bean",
			ReleaseYear:   2022,
			Genres:        []string{"Slice of Life", "Sci-Fi", "Comedy"},
			UpdatedAt:     "2026-05-20T11:00:00Z",
			Chapters: []types.Chapter{
				{Slug: "chapter-024", NumberLabel: "Chapter 24", NumberSort: 24, Title: "Last Order Before Dawn", PublishedAt: "2026-05-20T11:00:00Z", Pages: pages("orbit-cafe", "024", 4)},
				{Slug: "chapter-023", NumberLabel: "Chapter 23", NumberSort: 23, Title: "Meteor Foam", PublishedAt: "2026-05-13T11:00:00Z", Pages: pages("orbit-cafe", "023", 3)},
			},
		},
	}
}
