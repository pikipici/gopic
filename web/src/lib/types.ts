export type SeriesType = "manga" | "manhwa" | "manhua" | "comic";

export type SeriesStatus = "ongoing" | "completed" | "hiatus";

export type ContentRating = "all" | "teen" | "mature";

export type Demographic = "shounen" | "shoujo" | "seinen" | "josei" | "general";

export type ChapterPage = {
  pageNumber: number;
  imageUrl: string;
  width?: number;
  height?: number;
};

export type Chapter = {
  slug: string;
  numberLabel: string;
  numberSort: number;
  title: string;
  publishedAt: string;
  pages: ChapterPage[];
};

export type ChapterSummary = Omit<Chapter, "pages"> & {
  pageCount: number;
};

export type Series = {
  slug: string;
  title: string;
  altTitles: string[];
  synopsis: string;
  coverUrl: string;
  type: SeriesType;
  status: SeriesStatus;
  contentRating: ContentRating;
  demographic: Demographic;
  authorName: string;
  artistName: string;
  releaseYear: number;
  genres: string[];
  chapters: Chapter[];
  featured?: boolean;
  updatedAt: string;
  sourceId?: string;
  sourceSeriesId?: string;
  sourceUrl?: string;
  lastSyncedAt?: string;
};

export type SeriesSummary = Omit<Series, "chapters"> & {
  chapterCount: number;
  latestChapter?: ChapterSummary;
};

export type SeriesDetail = Omit<Series, "chapters"> & {
  chapterCount: number;
  latestChapter?: ChapterSummary;
  chapters: ChapterSummary[];
};

export type ChapterReader = {
  series: Pick<Series, "slug" | "title">;
  chapter: Chapter;
};
