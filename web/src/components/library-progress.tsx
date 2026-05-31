"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { getReadingProgress, type ReadingProgress } from "@/lib/reading-progress";
import type { SeriesSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function LibraryProgress({ seriesList }: { seriesList: SeriesSummary[] }) {
  const [progress] = useState<ReadingProgress[]>(() => getReadingProgress());

  const records = useMemo(
    () =>
      progress
        .map((item) => {
          const series = seriesList.find((candidate) => candidate.slug === item.seriesSlug);
          return series ? { ...item, series } : null;
        })
        .filter((item) => item !== null),
    [progress, seriesList],
  );

  if (!records.length) {
    return (
      <EmptyState
        title="Belum ada progress lokal"
        description="Buka reader chapter dulu, scroll beberapa halaman, lalu balik ke sini. Progress disimpan di browser ini."
        href="/series"
        action="Cari chapter"
      />
    );
  }

  return (
    <div className="grid gap-3">
      {records.map(({ series, chapterSlug, pageNumber, updatedAt }) => (
        <Link
          key={`${series.slug}-${chapterSlug}`}
          href={`/series/${series.slug}/${chapterSlug}`}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-lime-300/40 hover:bg-white/[0.07]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-white">{series.title}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {chapterSlug} · page {pageNumber}
              </p>
            </div>
            <span className="text-sm text-zinc-500">{formatDate(updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
