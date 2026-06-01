import Link from "next/link";
import type { ReactNode } from "react";
import { ContinueReadingCard } from "@/components/continue-reading-card";
import { EmptyState } from "@/components/empty-state";
import { SeriesCard } from "@/components/series-card";
import { formatDate, titleCase } from "@/lib/format";
import { getAllGenres, getAllSeries, getFeaturedSeries, getRecentChapters } from "@/lib/catalog";
import type { ChapterSummary, SeriesSummary } from "@/lib/types";

export default async function Home() {
  const [featured, recentChapters, allSeries, allGenres] = await Promise.all([
    getFeaturedSeries(),
    getRecentChapters(),
    getAllSeries(),
    getAllGenres(),
  ]);

  const readableSeries = allSeries.filter((series) => series.latestChapter && series.latestChapter.pageCount > 0);
  const partialCount = allSeries.filter((series) => series.latestChapter && series.latestChapter.pageCount === 0).length;
  const metadataOnlyCount = allSeries.filter((series) => !series.latestChapter).length;
  const heroSeries = pickHeroSeries(featured, readableSeries, allSeries);
  const trending = [...readableSeries].sort((a, b) => b.chapterCount - a.chapterCount).slice(0, 8);
  const recentlyAdded = allSeries.slice(0, 8);
  const recent = recentChapters.slice(0, 10);
  const genres = allGenres.slice(0, 14);
  const sourceStats = buildSourceStats(allSeries);

  return (
    <main className="overflow-hidden bg-[#050506]">
      <section className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(190,242,100,0.18),transparent_26%),radial-gradient(circle_at_82%_16%,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,#09090b_0%,#050506_72%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.12fr)_22rem] lg:px-8 lg:py-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-lime-200">
                Gomic discovery
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">
                {allSeries.length} titles / {readableSeries.length} readable
              </span>
            </div>

            {heroSeries ? <HeroFeature series={heroSeries} /> : <EmptyHero />}

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Catalog" value={allSeries.length.toString()} tone="lime" />
              <Stat label="Readable" value={readableSeries.length.toString()} tone="sky" />
              <Stat label="Partial" value={partialCount.toString()} tone="amber" />
            </div>

            <ContinueReadingCard seriesList={allSeries} />
          </div>

          <aside className="space-y-4 lg:pt-11">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Hot updates</p>
                  <h2 className="mt-1 text-xl font-black text-white">Fresh chapters</h2>
                </div>
                <Link href="/series" className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400 hover:text-lime-200">
                  All
                </Link>
              </div>
              {recent.length ? (
                <div className="space-y-2">
                  {recent.slice(0, 5).map(({ series, chapter }, index) => (
                    <UpdateRow key={`${series.slug}-${chapter.slug}`} series={series} chapter={chapter} index={index + 1} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
                  Belum ada chapter dengan pages. Import chapter readable dulu buat mengisi feed ini.
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Source mix</p>
              <div className="mt-4 space-y-3">
                {sourceStats.map((source) => (
                  <div key={source.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-sm font-bold text-zinc-200">{source.label}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">{source.count}</span>
                  </div>
                ))}
                {metadataOnlyCount ? (
                  <div className="rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
                    {metadataOnlyCount} title masih metadata-only.
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section className="border-b border-white/10 bg-black/30 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader kicker="Trending" title="Bacaan paling aktif" href="/series" />
          {trending.length ? (
            <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 xl:grid-cols-5">
              {trending.map((series) => (
                <div key={series.slug} className="min-w-64 lg:min-w-0">
                  <SeriesCard series={series} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Belum ada trending readable" description="Begitu chapter berisi pages tersedia, rail ini otomatis keisi." />
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
        <div>
          <SectionHeader kicker="Latest" title="Update chapter terbaru" href="/series" />
          {recent.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {recent.map(({ series, chapter }, index) => (
                <UpdateCard key={`${series.slug}-${chapter.slug}`} series={series} chapter={chapter} index={index + 1} />
              ))}
            </div>
          ) : (
            <EmptyState title="Belum ada readable chapter" description="Import chapter dengan pages dulu supaya latest updates terisi." />
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Genre rail</p>
            <h2 className="mt-2 text-2xl font-black text-white">Jalur cepat eksplor.</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {genres.length ? (
                genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/series?genre=${encodeURIComponent(genre)}`}
                    className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-lime-300/50 hover:bg-lime-300/10 hover:text-lime-100"
                  >
                    {genre}
                  </Link>
                ))
              ) : (
                <span className="text-sm text-zinc-500">Genre belum tersedia.</span>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.12),transparent_34%),rgba(255,255,255,0.04)] p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Platform state</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="Sources" value={sourceStats.length.toString()} />
              <MiniStat label="Partial" value={partialCount.toString()} />
              <MiniStat label="Genres" value={allGenres.length.toString()} />
              <MiniStat label="Metadata" value={metadataOnlyCount.toString()} />
            </div>
          </section>
        </aside>
      </section>

      <section className="border-y border-white/10 bg-[radial-gradient(circle_at_18%_20%,rgba(190,242,100,0.1),transparent_30%),rgba(255,255,255,0.03)] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader kicker="Recently added" title="Baru masuk catalog" href="/series" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyAdded.map((series) => (
              <CompactSeriesLink key={series.slug} series={series} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function pickHeroSeries(featured: SeriesSummary[], readable: SeriesSummary[], allSeries: SeriesSummary[]) {
  return featured.find((series) => series.coverUrl) ?? readable.find((series) => series.coverUrl) ?? allSeries[0];
}

function sourceLabel(sourceId?: string) {
  if (sourceId === "komikcast") return "KomikCast";
  if (sourceId === "komikindo") return "KomikIndo";
  if (sourceId === "mock-mihon") return "Mock";
  return "Seed";
}

function buildSourceStats(seriesList: SeriesSummary[]) {
  const counts = new Map<string, number>();
  for (const series of seriesList) {
    const id = series.sourceId ?? "seed";
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, count, label: sourceLabel(id) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function HeroFeature({ series }: { series: SeriesSummary }) {
  const latest = series.latestChapter;
  const latestHref = latest && latest.pageCount > 0 ? `/series/${series.slug}/${latest.slug}` : `/series/${series.slug}`;

  return (
    <article className="grid overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025))] shadow-2xl shadow-black/35 sm:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Link href={`/series/${series.slug}`} className="relative min-h-80 overflow-hidden bg-zinc-950 sm:min-h-full">
        {series.coverUrl ? (
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center opacity-95 transition duration-700 hover:scale-110"
            style={{ backgroundImage: `url(${series.coverUrl})` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full border border-lime-300/30 bg-lime-300/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-lime-100 backdrop-blur">
          Featured
        </div>
      </Link>
      <div className="flex flex-col justify-between gap-8 p-6 sm:p-7 lg:p-8">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{sourceLabel(series.sourceId)}</Badge>
            <Badge>{titleCase(series.type)}</Badge>
            <Badge>{titleCase(series.status)}</Badge>
            <Badge>{series.chapterCount} ch</Badge>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {series.title}
          </h1>
          <p className="mt-5 line-clamp-4 max-w-2xl text-base leading-7 text-zinc-300 lg:text-lg lg:leading-8">
            {series.synopsis || "Belum ada synopsis dari source ini, tapi title ini sudah masuk catalog Gomic."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={latestHref} className="rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black transition hover:bg-lime-200">
            {latest && latest.pageCount > 0 ? `Read ${latest.numberLabel}` : "Open Detail"}
          </Link>
          <Link href="/series" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">
            Browse Catalog
          </Link>
          {latest ? (
            <span className="rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-bold text-zinc-300">
              Updated {formatDate(latest.publishedAt)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyHero() {
  return (
    <div className="rounded-[2.25rem] border border-white/10 bg-white/[0.04] p-8">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-300">Catalog kosong</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">Import title pertama buat menghidupkan Gomic.</h1>
      <p className="mt-5 max-w-2xl text-zinc-400">Home discovery akan otomatis memakai data import dari API begitu catalog tersedia.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/admin" className="rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black transition hover:bg-lime-200">
          Open Admin
        </Link>
        <Link href="/series" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">
          Browse Catalog
        </Link>
      </div>
    </div>
  );
}

function UpdateRow({ series, chapter, index }: { series: SeriesSummary; chapter: ChapterSummary; index: number }) {
  return (
    <Link href={`/series/${series.slug}/${chapter.slug}`} className="group flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-lime-300/35 hover:bg-white/[0.06]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-zinc-300 group-hover:bg-lime-300 group-hover:text-black">
        {index}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white group-hover:text-lime-100">{series.title}</span>
        <span className="mt-1 block truncate text-xs text-zinc-500">{chapter.numberLabel} / {formatDate(chapter.publishedAt)}</span>
      </span>
    </Link>
  );
}

function UpdateCard({ series, chapter, index }: { series: SeriesSummary; chapter: ChapterSummary; index: number }) {
  return (
    <Link
      href={`/series/${series.slug}/${chapter.slug}`}
      className="group grid grid-cols-[3.25rem_minmax(0,1fr)] gap-4 rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.02))] p-4 transition hover:-translate-y-0.5 hover:border-lime-300/40 hover:bg-white/[0.07]"
    >
      <span className="flex aspect-square items-center justify-center rounded-2xl bg-black/35 text-sm font-black text-lime-200 ring-1 ring-white/10 group-hover:bg-lime-300 group-hover:text-black">
        {String(index).padStart(2, "0")}
      </span>
      <span className="min-w-0">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{sourceLabel(series.sourceId)} / {formatDate(chapter.publishedAt)}</span>
        <span className="mt-2 block truncate text-lg font-black text-white group-hover:text-lime-100">{series.title}</span>
        <span className="mt-1 block truncate text-sm text-zinc-400">{chapter.numberLabel} / {chapter.title || "Untitled chapter"}</span>
      </span>
    </Link>
  );
}

function CompactSeriesLink({ series }: { series: SeriesSummary }) {
  return (
    <Link href={`/series/${series.slug}`} className="group flex gap-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-3 transition hover:border-lime-300/40 hover:bg-white/[0.06]">
      <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-900">
        {series.coverUrl ? <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-110" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : null}
      </span>
      <span className="min-w-0 py-1">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">{sourceLabel(series.sourceId)}</span>
        <span className="mt-1 line-clamp-2 text-base font-black leading-tight text-white">{series.title}</span>
        <span className="mt-2 block text-xs text-zinc-500">{titleCase(series.status)} / {series.chapterCount} chapters</span>
      </span>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "lime" | "sky" | "amber" }) {
  const toneClass = tone === "lime" ? "text-lime-200" : tone === "sky" ? "text-sky-200" : "text-amber-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-xl shadow-black/10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`mt-1 text-3xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-300">{children}</span>;
}

function SectionHeader({ kicker, title, href }: { kicker: string; title: string; href: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-300">{kicker}</p>
        <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
      </div>
      <Link href={href} className="shrink-0 text-sm font-black text-zinc-300 hover:text-lime-200">
        Lihat semua
      </Link>
    </div>
  );
}
