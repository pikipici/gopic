"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { getReadingProgress, type ReadingProgress } from "@/lib/reading-progress";
import type { ChapterSummary, SeriesDetail } from "@/lib/types";

export function ChapterList({ series }: { series: SeriesDetail }) {
  const [progressItems, setProgressItems] = useState<ReadingProgress[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setProgressItems(getReadingProgress().filter((item) => item.seriesSlug === series.slug));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [series.slug]);

  const latestProgress = progressItems[0] ?? null;
  const latest = series.chapters.find((chapter) => chapter.pageCount > 0);
  const resumeChapter = latestProgress ?? (latest ? { chapterSlug: latest.slug, pageNumber: 1, totalPages: latest.pageCount, read: false } : null);
  const readyCount = series.chapters.filter((chapter) => chapter.pageCount > 0).length;
  const progressByChapter = new Map(progressItems.map((item) => [item.chapterSlug, item]));

  return (
    <>
      <div className="grid gap-2 border-b border-zinc-700 pb-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">Search chapter...</div>
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300">All groups ▾</div>
        <div className="flex overflow-hidden rounded-md border border-zinc-700 text-sm font-medium">
          <span className="bg-cyan-500/20 px-3 py-2 text-cyan-400">↓ Chapter</span>
          <span className="px-3 py-2 text-zinc-400">Volume</span>
          <span className="px-3 py-2 text-zinc-400">Date</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-700 bg-zinc-900 p-3">
        {resumeChapter ? (
          <Link href={`/series/${series.slug}/${resumeChapter.chapterSlug}`} className="inline-flex rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-600">
            {latestProgress ? `Lanjut page ${latestProgress.pageNumber}/${latestProgress.totalPages}` : `Baca ${latest?.numberLabel}`}
          </Link>
        ) : (
          <div className="rounded-md border border-amber-200/20 bg-amber-200/10 px-4 py-2.5 text-sm font-bold text-amber-100">Belum ada chapter yang siap dibaca.</div>
        )}
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{readyCount} ready / {series.chapters.length} total</span>
      </div>

      <div className="mt-4 divide-y divide-zinc-700 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
        {series.chapters.map((chapter) => (
          <ChapterRow key={chapter.slug} seriesSlug={series.slug} chapter={chapter} progress={progressByChapter.get(chapter.slug) ?? null} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <span>Showing 1 to {series.chapters.length} of {series.chapters.length} items</span>
        <div className="flex gap-1 font-medium"><span className="rounded bg-cyan-500 px-2.5 py-1 text-white">1</span><span className="rounded bg-zinc-800 px-2.5 py-1 text-zinc-300">2</span><span className="rounded bg-zinc-800 px-2.5 py-1 text-zinc-300">›</span></div>
      </div>
    </>
  );
}

function ChapterRow({ seriesSlug, chapter, progress }: { seriesSlug: string; chapter: ChapterSummary; progress: ReadingProgress | null }) {
  const hasPages = chapter.pageCount > 0;
  const progressLabel = !hasPages ? "Partial import" : progress?.read ? "Read" : progress ? `Page ${progress.pageNumber}/${progress.totalPages}` : "Unread";
  const progressClass = !hasPages
    ? "border-amber-200/25 bg-amber-200/10 text-amber-100"
    : progress?.read
      ? "border-green-300/30 bg-green-300/10 text-green-200"
      : progress
      ? "border-sky-300/30 bg-sky-300/10 text-sky-200"
      : "border-zinc-700 bg-zinc-800 text-zinc-400";
  const rowClass = hasPages
    ? "bg-zinc-900 hover:bg-zinc-800/80"
    : "bg-amber-200/[0.05] opacity-90";
  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`shrink-0 text-sm font-medium ${hasPages ? "text-cyan-400" : "text-amber-100"}`}>
          Ch.{chapter.numberSort || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-200">{chapter.title || chapter.numberLabel}</span>
          <span className="mt-1 block text-xs text-zinc-500">{formatDate(chapter.publishedAt)} / {hasPages ? `${chapter.pageCount} pages ready` : "metadata saved, pages missing"}</span>
          {!hasPages ? <span className="mt-1 block text-xs font-semibold text-amber-100">Chapter ini belum bisa dibuka sampai pages di-sync/import ulang.</span> : null}
        </span>
      </div>
      <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">👍 {Math.max(1, chapter.pageCount + Math.round(chapter.numberSort || 0))}</span>
      <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${progressClass}`}>{progressLabel}</span>
      <span className="shrink-0 text-zinc-500 transition group-hover:text-cyan-400">🔖</span>
    </>
  );

  if (!hasPages) {
    return <div className={`group flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${rowClass}`}>{content}</div>;
  }

  return (
    <Link href={`/series/${seriesSlug}/${chapter.slug}`} className={`group flex flex-col gap-3 px-3 py-3 transition sm:flex-row sm:items-center sm:justify-between ${rowClass}`}>
      {content}
    </Link>
  );
}
