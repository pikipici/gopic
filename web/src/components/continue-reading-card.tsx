"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getReadingProgress } from "@/lib/reading-progress";
import type { SeriesSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function ContinueReadingCard({ seriesList }: { seriesList: SeriesSummary[] }) {
  const [progress] = useState(() => getReadingProgress()[0]);

  const record = useMemo(() => {
    if (!progress) return null;
    const series = seriesList.find((item) => item.slug === progress.seriesSlug);
    return series ? { series, progress } : null;
  }, [progress, seriesList]);

  if (!record) {
    return (
      <Link
        href="/series"
        className="mt-8 inline-flex rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/10"
      >
        Start Reading
      </Link>
    );
  }

  const { series } = record;
  const percent = Math.round((record.progress.pageNumber / record.progress.totalPages) * 100);

  return (
    <Link
      href={`/series/${series.slug}/${record.progress.chapterSlug}`}
      className="mt-8 inline-flex flex-col rounded-[1.5rem] border border-lime-300/30 bg-lime-300/10 px-5 py-4 text-left transition hover:bg-lime-300/15 sm:min-w-80"
    >
      <span className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Continue reading</span>
      <span className="mt-2 font-black text-white">{series.title}</span>
      <span className="mt-1 text-sm text-zinc-400">
        {record.progress.chapterSlug} · page {record.progress.pageNumber}/{record.progress.totalPages} · {percent}% · {formatDate(record.progress.updatedAt)}
      </span>
    </Link>
  );
}
