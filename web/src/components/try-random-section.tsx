"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { titleCase } from "@/lib/format";
import type { SeriesSummary } from "@/lib/types";

type TryRandomSectionProps = {
  seriesList: SeriesSummary[];
  limit?: number;
};

export function TryRandomSection({ seriesList, limit = 10 }: TryRandomSectionProps) {
  const candidates = useMemo(() => {
    const readable = seriesList.filter((series) => series.latestChapter && series.latestChapter.pageCount > 0);
    return readable.length ? readable : seriesList;
  }, [seriesList]);
  const [seed, setSeed] = useState(0);
  const picks = useMemo(() => pickRandomSeries(candidates, limit, seed), [candidates, limit, seed]);

  if (!picks.length) {
    return null;
  }

  return (
    <section className="border-y border-white/10 bg-[radial-gradient(circle_at_18%_20%,rgba(190,242,100,0.07),transparent_30%),rgba(255,255,255,0.03)] py-7">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Try Random</p>
            <h2 className="mt-1 text-2xl font-black text-white">Coba bacaan acak</h2>
          </div>
          <button
            type="button"
            onClick={() => setSeed(Date.now())}
            className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-200 transition hover:border-lime-300/45 hover:bg-lime-300/10 hover:text-lime-100"
          >
            Acak ulang
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {picks.map((series) => (
            <CompactSeriesLink key={series.slug} series={series} />
          ))}
        </div>
      </div>
    </section>
  );
}

function pickRandomSeries(seriesList: SeriesSummary[], limit: number, seed: number) {
  return [...seriesList]
    .map((series, index) => ({ series, sort: seededSortValue(`${seed}:${series.slug}:${index}`) }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, limit)
    .map(({ series }) => series);
}

function seededSortValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function CompactSeriesLink({ series }: { series: SeriesSummary }) {
  return (
    <Link href={`/series/${series.slug}`} className="group flex gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5 transition hover:border-lime-300/40 hover:bg-white/[0.06]">
      <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
        {series.coverUrl ? <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-110" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : null}
      </span>
      <span className="min-w-0 py-1">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">{titleCase(series.type)}</span>
        <span className="mt-1 line-clamp-2 text-sm font-black leading-tight text-white">{series.title}</span>
        <span className="mt-2 block text-xs text-zinc-500">{titleCase(series.status)} / {series.chapterCount} chapters</span>
      </span>
    </Link>
  );
}
