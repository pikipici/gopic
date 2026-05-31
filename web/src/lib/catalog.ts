import { seriesSeed } from "./seed";
import type { Chapter, ChapterReader, ChapterSummary, Series, SeriesDetail, SeriesSummary } from "./types";

type ApiEnvelope<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: null | { code: string; message: string };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

function summarizeChapter(chapter: Chapter): ChapterSummary {
  return {
    slug: chapter.slug,
    numberLabel: chapter.numberLabel,
    numberSort: chapter.numberSort,
    title: chapter.title,
    publishedAt: chapter.publishedAt,
    pageCount: chapter.pages.length,
  };
}

function summarizeSeries(series: Series): SeriesSummary {
  const latestChapter = series.chapters[0] ? summarizeChapter(series.chapters[0]) : undefined;

  return {
    slug: series.slug,
    title: series.title,
    altTitles: series.altTitles,
    synopsis: series.synopsis,
    coverUrl: series.coverUrl,
    type: series.type,
    status: series.status,
    contentRating: series.contentRating,
    demographic: series.demographic,
    authorName: series.authorName,
    artistName: series.artistName,
    releaseYear: series.releaseYear,
    genres: series.genres,
    chapterCount: series.chapters.length,
    latestChapter,
    featured: series.featured,
    updatedAt: series.updatedAt,
  };
}

function detailFromSeed(series: Series): SeriesDetail {
  return {
    ...summarizeSeries(series),
    chapters: series.chapters.map(summarizeChapter),
  };
}

async function fetchApi<T>(path: string): Promise<T | null> {
  if (!apiBaseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { next: { revalidate: 30 } });
    if (!response.ok) {
      return null;
    }
    const envelope = (await response.json()) as ApiEnvelope<T>;
    return envelope.error ? null : envelope.data;
  } catch {
    return null;
  }
}

export async function getAllSeries(): Promise<SeriesSummary[]> {
  const apiSeries = await fetchApi<SeriesSummary[]>("/api/v1/series?limit=100");
  if (apiSeries) {
    return apiSeries;
  }

  return [...seriesSeed].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarizeSeries);
}

export async function getFeaturedSeries(): Promise<SeriesSummary[]> {
  return (await getAllSeries()).filter((series) => series.featured);
}

export async function getRecentChapters() {
  const details = await getAllSeriesDetails();

  return details
    .flatMap((series) =>
      series.chapters.map((chapter) => ({
        series,
        chapter,
      })),
    )
    .sort((a, b) => b.chapter.publishedAt.localeCompare(a.chapter.publishedAt));
}

export async function getSeriesBySlug(slug: string): Promise<SeriesDetail | undefined> {
  const apiSeries = await fetchApi<SeriesDetail>(`/api/v1/series/${slug}`);
  if (apiSeries) {
    return apiSeries;
  }

  const series = seriesSeed.find((item) => item.slug === slug);
  return series ? detailFromSeed(series) : undefined;
}

export async function getChapter(seriesSlug: string, chapterSlug: string): Promise<ChapterReader | null> {
  const apiChapter = await fetchApi<ChapterReader>(`/api/v1/series/${seriesSlug}/chapters/${chapterSlug}`);
  if (apiChapter) {
    return apiChapter;
  }

  const series = seriesSeed.find((item) => item.slug === seriesSlug);
  const chapter = series?.chapters.find((item) => item.slug === chapterSlug);

  if (!series || !chapter) {
    return null;
  }

  return {
    series: { slug: series.slug, title: series.title },
    chapter,
  };
}

export async function getAllGenres(): Promise<string[]> {
  const apiGenres = await fetchApi<string[]>("/api/v1/genres");
  if (apiGenres) {
    return apiGenres;
  }

  return Array.from(new Set(seriesSeed.flatMap((series) => series.genres))).sort();
}

export function getSeedStaticParams() {
  return seriesSeed.map((series) => ({ slug: series.slug }));
}

export function getSeedChapterStaticParams() {
  return seriesSeed.flatMap((series) =>
    series.chapters.map((chapter) => ({
      slug: series.slug,
      chapterSlug: chapter.slug,
    })),
  );
}

async function getAllSeriesDetails(): Promise<SeriesDetail[]> {
  const series = await getAllSeries();
  const details = await Promise.all(series.map((item) => getSeriesBySlug(item.slug)));
  return details.filter((item): item is SeriesDetail => Boolean(item));
}
