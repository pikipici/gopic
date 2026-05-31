"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDate } from "@/lib/format";
import { getChapterProgress, getLatestSeriesProgress } from "@/lib/reading-progress";
import type { ChapterSummary, SeriesDetail } from "@/lib/types";

export function ChapterList({ series }: { series: SeriesDetail }) {
  const latestProgress = useMemo(() => getLatestSeriesProgress(series.slug), [series.slug]);
  const latest = series.chapters[0];
  const resumeChapter = latestProgress ?? (latest ? { chapterSlug: latest.slug, pageNumber: 1, totalPages: latest.pageCount, read: false } : null);

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3">
        {resumeChapter ? (
          <Link href={`/series/${series.slug}/${resumeChapter.chapterSlug}`} className="inline-flex rounded-full bg-lime-300 px-6 py-3 font-bold text-black transition hover:bg-lime-200">
            {latestProgress ? `Lanjut page ${latestProgress.pageNumber}/${latestProgress.totalPages}` : `Baca ${latest?.numberLabel}`}
          </Link>
        ) : null}
      </div>

      <div className="mt-5 divide-y divide-white/10">
        {series.chapters.map((chapter) => (
          <ChapterRow key={chapter.slug} seriesSlug={series.slug} chapter={chapter} />
        ))}
      </div>
    </>
  );
}

function ChapterRow({ seriesSlug, chapter }: { seriesSlug: string; chapter: ChapterSummary }) {
  const progress = getChapterProgress(seriesSlug, chapter.slug);
  const progressLabel = progress?.read ? "Read" : progress ? `Page ${progress.pageNumber}/${progress.totalPages}` : "Unread";
  const progressClass = progress?.read
    ? "border-lime-300/30 bg-lime-300/10 text-lime-200"
    : progress
      ? "border-sky-300/30 bg-sky-300/10 text-sky-200"
      : "border-white/10 bg-white/[0.03] text-zinc-500";

  return (
    <Link
      href={`/series/${seriesSlug}/${chapter.slug}`}
      className="flex flex-col gap-3 py-4 transition hover:text-lime-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <span>
        <span className="block font-semibold text-white">{chapter.numberLabel} · {chapter.title}</span>
        <span className="mt-1 block text-sm text-zinc-500">{formatDate(chapter.publishedAt)}</span>
      </span>
      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${progressClass}`}>{progressLabel}</span>
    </Link>
  );
}
