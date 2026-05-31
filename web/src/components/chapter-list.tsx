"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDate } from "@/lib/format";
import { getChapterProgress, getLatestSeriesProgress } from "@/lib/reading-progress";
import type { ChapterSummary, SeriesDetail } from "@/lib/types";

export function ChapterList({ series }: { series: SeriesDetail }) {
  const latestProgress = useMemo(() => getLatestSeriesProgress(series.slug), [series.slug]);
  const latest = series.chapters.find((chapter) => chapter.pageCount > 0);
  const resumeChapter = latestProgress ?? (latest ? { chapterSlug: latest.slug, pageNumber: 1, totalPages: latest.pageCount, read: false } : null);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {resumeChapter ? (
          <Link href={`/series/${series.slug}/${resumeChapter.chapterSlug}`} className="inline-flex rounded-full bg-lime-300 px-6 py-3 font-black text-black transition hover:bg-lime-200">
            {latestProgress ? `Lanjut page ${latestProgress.pageNumber}/${latestProgress.totalPages}` : `Baca ${latest?.numberLabel}`}
          </Link>
        ) : (
          <div className="rounded-full border border-amber-200/20 bg-amber-200/10 px-5 py-3 text-sm font-bold text-amber-100">Belum ada chapter yang siap dibaca.</div>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        {series.chapters.map((chapter) => (
          <ChapterRow key={chapter.slug} seriesSlug={series.slug} chapter={chapter} />
        ))}
      </div>
    </>
  );
}

function ChapterRow({ seriesSlug, chapter }: { seriesSlug: string; chapter: ChapterSummary }) {
  const progress = getChapterProgress(seriesSlug, chapter.slug);
  const hasPages = chapter.pageCount > 0;
  const progressLabel = !hasPages ? "No pages" : progress?.read ? "Read" : progress ? `Page ${progress.pageNumber}/${progress.totalPages}` : "Unread";
  const progressClass = !hasPages
    ? "border-amber-200/25 bg-amber-200/10 text-amber-100"
    : progress?.read
      ? "border-lime-300/30 bg-lime-300/10 text-lime-200"
      : progress
        ? "border-sky-300/30 bg-sky-300/10 text-sky-200"
        : "border-white/10 bg-white/[0.03] text-zinc-500";
  const rowClass = hasPages
    ? "border-white/10 bg-black/25 hover:border-lime-300/40 hover:bg-lime-300/[0.06] hover:text-lime-100"
    : "border-amber-200/15 bg-amber-200/[0.06] opacity-85";
  const content = (
    <>
      <div>
        <span className="block font-bold text-white">{chapter.numberLabel} / {chapter.title || "Untitled chapter"}</span>
        <span className="mt-1 block text-sm text-zinc-500">{formatDate(chapter.publishedAt)} / {chapter.pageCount} pages</span>
      </div>
      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${progressClass}`}>{progressLabel}</span>
    </>
  );

  if (!hasPages) {
    return <div className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${rowClass}`}>{content}</div>;
  }

  return (
    <Link href={`/series/${seriesSlug}/${chapter.slug}`} className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between ${rowClass}`}>
      {content}
    </Link>
  );
}
