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
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 p-5 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">Continue queue</p>
          <h2 className="mt-2 text-2xl font-black text-white">Terakhir dibaca</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-500 sm:mt-0">{records.length} local records</p>
      </div>
      <div className="grid gap-3 p-4 sm:p-5">
        {records.map(({ series, chapterSlug, pageNumber, totalPages, updatedAt }) => {
          const percent = Math.min(100, Math.round((pageNumber / totalPages) * 100));
          return (
            <Link
              key={`${series.slug}-${chapterSlug}`}
              href={`/series/${series.slug}/${chapterSlug}`}
              className="group rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 transition hover:-translate-y-0.5 hover:border-lime-300/40 hover:bg-white/[0.07]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="line-clamp-1 font-black text-white group-hover:text-lime-100">{series.title}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                    {chapterSlug} / page {pageNumber}/{totalPages} / {formatDate(updatedAt)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-black">{percent}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-lime-300" style={{ width: `${percent}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
