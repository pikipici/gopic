"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getReadingProgress, type ReadingProgress } from "@/lib/reading-progress";
import type { SeriesSummary } from "@/lib/types";

export function ContinueReadingCard({ seriesList }: { seriesList: SeriesSummary[] }) {
  const [progressList, setProgressList] = useState<ReadingProgress[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setProgressList(getReadingProgress());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const records = useMemo(() => {
    const seen = new Set<string>();
    return progressList
      .filter((progress) => {
        if (seen.has(progress.seriesSlug)) return false;
        seen.add(progress.seriesSlug);
        return true;
      })
      .map((progress) => {
        const series = seriesList.find((item) => item.slug === progress.seriesSlug);
        return series ? { series, progress } : null;
      })
      .filter((item): item is { series: SeriesSummary; progress: ReadingProgress } => Boolean(item))
      .slice(0, 8);
  }, [progressList, seriesList]);

  if (!records.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#111114] p-3 shadow-xl shadow-black/20">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-300">Continue</p>
          <h2 className="text-base font-black text-white">Lanjut baca</h2>
        </div>
        <Link href="/library" className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 transition hover:text-lime-200">
          Library
        </Link>
      </div>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {records.map(({ series, progress }) => (
          <ContinuePoster key={`${series.slug}-${progress.chapterSlug}`} series={series} progress={progress} />
        ))}
      </div>
    </section>
  );
}

function ContinuePoster({ series, progress }: { series: SeriesSummary; progress: ReadingProgress }) {
  const totalPages = Math.max(progress.totalPages, 1);
  const pageNumber = Math.min(Math.max(progress.pageNumber, 1), totalPages);
  const percent = Math.min(Math.max(Math.round((pageNumber / totalPages) * 100), 0), 100);
  const circumference = 2 * Math.PI * 14;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <Link href={`/series/${series.slug}/${progress.chapterSlug}`} className="group min-w-28 shrink-0 sm:min-w-32">
      <span className="relative block h-40 overflow-hidden rounded-lg border border-white/10 bg-zinc-950 sm:h-48">
        {series.coverUrl ? (
          <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${series.coverUrl})` }} />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(190,242,100,0.18),transparent_42%),#18181b] text-xl font-black text-zinc-500">
            {series.title.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
        <span className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/70 text-[10px] font-black text-white backdrop-blur">
          <svg className="absolute inset-0 size-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgb(190,242,100)" strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" />
          </svg>
          {percent}%
        </span>
        <span className="absolute inset-x-0 bottom-0 p-2">
          <span className="line-clamp-2 text-xs font-black leading-tight text-white">{series.title}</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-lime-200">
            Page {pageNumber}/{totalPages}
          </span>
        </span>
      </span>
    </Link>
  );
}
