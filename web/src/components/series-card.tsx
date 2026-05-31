import Link from "next/link";
import type { SeriesSummary } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/format";

function sourceLabel(sourceId?: string) {
  if (sourceId === "komikcast") return "KomikCast";
  if (sourceId === "komikindo") return "KomikIndo";
  if (sourceId === "mock-mihon") return "Mock";
  return "Seed";
}

function sourceClass(sourceId?: string) {
  if (sourceId === "komikcast") return "border-sky-300/30 bg-sky-300/15 text-sky-100";
  if (sourceId === "komikindo") return "border-amber-300/30 bg-amber-300/15 text-amber-100";
  if (sourceId === "mock-mihon") return "border-fuchsia-300/30 bg-fuchsia-300/15 text-fuchsia-100";
  return "border-white/15 bg-white/10 text-white";
}

export function SeriesCard({ series }: { series: SeriesSummary }) {
  const latest = series.latestChapter;
  const hasPages = latest ? latest.pageCount > 0 : false;
  const readableLabel = hasPages ? "Ready" : latest ? "Partial" : "Metadata";

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:border-lime-300/45 hover:shadow-lime-950/30">
      <Link href={`/series/${series.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(190,242,100,0.22),transparent_35%),linear-gradient(135deg,#27272a,#09090b)]">
          {series.coverUrl ? (
            <div
              className="absolute inset-0 opacity-95 transition duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] backdrop-blur ${sourceClass(series.sourceId)}`}>
              {sourceLabel(series.sourceId)}
            </span>
            <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
              {readableLabel}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
              {titleCase(series.type)} / {titleCase(series.status)} / {series.chapterCount} ch
            </p>
            <h3 className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white">{series.title}</h3>
          </div>
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-zinc-400">
          {series.synopsis || "Belum ada synopsis dari source ini."}
        </p>
        <div className="flex min-h-7 flex-wrap gap-2">
          {series.genres.length ? (
            series.genres.slice(0, 3).map((genre) => (
              <span key={genre} className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
                {genre}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-500">No genres</span>
          )}
        </div>
        {latest ? (
          hasPages ? (
            <Link
              href={`/series/${series.slug}/${latest.slug}`}
              className="flex items-center justify-between rounded-2xl border border-lime-300/20 bg-lime-300/10 px-3 py-3 text-sm text-lime-100 transition hover:border-lime-300/60 hover:bg-lime-300/15"
            >
              <span className="font-bold">{latest.numberLabel}</span>
              <span className="text-xs text-lime-100/60">{formatDate(latest.publishedAt)}</span>
            </Link>
          ) : (
            <div className="rounded-2xl border border-amber-200/20 bg-amber-200/10 px-3 py-3 text-sm text-amber-100">
              {latest.numberLabel} / pages belum tersedia
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-500">Belum ada chapter.</div>
        )}
      </div>
    </article>
  );
}
