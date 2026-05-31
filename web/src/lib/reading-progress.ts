export type ReadingProgress = {
  seriesSlug: string;
  chapterSlug: string;
  pageNumber: number;
  totalPages: number;
  read: boolean;
  updatedAt: string;
};

export type ChapterProgressState = "unread" | "reading" | "read";

const STORAGE_KEY = "gomic:reading-progress:v2";
const LEGACY_STORAGE_KEY = "gomic:reading-progress:v1";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeProgress(item: Partial<ReadingProgress>): ReadingProgress | null {
  if (!item.seriesSlug || !item.chapterSlug || !item.pageNumber) {
    return null;
  }

  const totalPages = Math.max(Number(item.totalPages ?? item.pageNumber), 1);
  const pageNumber = Math.min(Math.max(Number(item.pageNumber), 1), totalPages);

  return {
    seriesSlug: item.seriesSlug,
    chapterSlug: item.chapterSlug,
    pageNumber,
    totalPages,
    read: Boolean(item.read) || pageNumber >= totalPages,
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  };
}

export function getReadingProgress(): ReadingProgress[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ReadingProgress>[]) : [];
    return parsed.map(normalizeProgress).filter((item): item is ReadingProgress => Boolean(item));
  } catch {
    return [];
  }
}

export function upsertReadingProgress(progress: Omit<ReadingProgress, "updatedAt" | "read"> & { read?: boolean }) {
  if (!canUseStorage()) {
    return;
  }

  const normalized = normalizeProgress({ ...progress, updatedAt: new Date().toISOString() });
  if (!normalized) {
    return;
  }

  const current = getReadingProgress().filter(
    (item) => !(item.seriesSlug === normalized.seriesSlug && item.chapterSlug === normalized.chapterSlug),
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([normalized, ...current].slice(0, 100)));
}

export function getChapterProgress(seriesSlug: string, chapterSlug: string) {
  return getReadingProgress().find((item) => item.seriesSlug === seriesSlug && item.chapterSlug === chapterSlug) ?? null;
}

export function getChapterProgressState(seriesSlug: string, chapterSlug: string): ChapterProgressState {
  const progress = getChapterProgress(seriesSlug, chapterSlug);
  if (!progress) {
    return "unread";
  }
  return progress.read ? "read" : "reading";
}

export function getLatestSeriesProgress(seriesSlug: string) {
  return getReadingProgress().find((item) => item.seriesSlug === seriesSlug) ?? null;
}
