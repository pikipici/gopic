import Link from "next/link";
import type { SeriesSummary } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/format";

function sourceLabel(sourceId?: string) {
  if (sourceId === "komikcast") return "KomikCast";
  if (sourceId === "komikindo") return "KomikIndo";
  if (sourceId === "mock-mihon") return "Mock";
  return "Seed";
}

export function SeriesCard({ series }: { series: SeriesSummary }) {
  const latest = series.latestChapter;
  const hasPages = latest ? latest.pageCount > 0 : false;

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-lime-300/40 hover:bg-white/[0.07]">
      <Link href={`/series/${series.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950">
          <div
            className="absolute inset-0 opacity-90 transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover" }}
          />
          <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-black text-white backdrop-blur">
            {sourceLabel(series.sourceId)}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
              {titleCase(series.type)} · {titleCase(series.status)} · {series.chapterCount} ch
            </p>
            <h3 className="mt-1 line-clamp-2 text-xl font-bold text-white">{series.title}</h3>
          </div>
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <p className="line-clamp-3 text-sm leading-6 text-zinc-400">{series.synopsis}</p>
        <div className="flex flex-wrap gap-2">
          {series.genres.slice(0, 3).map((genre) => (
            <span key={genre} className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
              {genre}
            </span>
          ))}
        </div>
        {latest ? (
          hasPages ? (
            <Link
              href={`/series/${series.slug}/${latest.slug}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm transition hover:border-lime-300/50 hover:text-lime-200"
            >
              <span>{latest.numberLabel}</span>
              <span className="text-xs text-zinc-500">{formatDate(latest.publishedAt)}</span>
            </Link>
          ) : (
            <div className="rounded-2xl border border-amber-200/20 bg-amber-200/10 px-3 py-3 text-sm text-amber-100">
              {latest.numberLabel} · pages belum tersedia
            </div>
          )
        ) : null}
      </div>
    </article>
  );
}
