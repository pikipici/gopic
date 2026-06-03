import Link from "next/link";
import { ContinueReadingCard } from "@/components/continue-reading-card";
import { EmptyState } from "@/components/empty-state";
import { TryRandomSection } from "@/components/try-random-section";
import { formatDate } from "@/lib/format";
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
  const mostRecent = buildUniqueSeries([...featured, ...readableSeries, ...allSeries]).slice(0, 24);
  const mostActive = [...readableSeries].sort((a, b) => b.chapterCount - a.chapterCount || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 24);
  const newComics = [...allSeries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 24);
  const latestUpdates = recentChapters.slice(0, 40);
  const genres = allGenres.slice(0, 20);

  return (
    <main className="min-h-screen bg-[#22282a] text-[#cdd5d6]">
      <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-8 sm:px-7 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,960px)_minmax(260px,1fr)]">
          <div className="min-w-0 space-y-12">
            <AnnouncementPanel total={allSeries.length} readable={readableSeries.length} genres={genres} />
            <ContinueReadingCard seriesList={allSeries} />

            <PosterRail title="Most Recent" suffix="Popular" seriesList={mostRecent} />
            <PosterRail title="Most Active" suffix="New Comics" seriesList={mostActive.length ? mostActive : newComics} />
            <UpdateGrid updates={latestUpdates} />
          </div>

          <aside className="min-w-0 space-y-8 lg:pt-0">
            <BrowsePanel genres={genres} />
            <CompactList title="Recently Added" seriesList={newComics.slice(0, 8)} />
            <CompactList title="Readable Now" seriesList={readableSeries.slice(0, 8)} />
          </aside>
        </div>
      </div>

      <TryRandomSection seriesList={allSeries} />
    </main>
  );
}

function buildUniqueSeries(seriesList: SeriesSummary[]) {
  const seen = new Set<string>();
  return seriesList.filter((series) => {
    if (seen.has(series.slug)) return false;
    seen.add(series.slug);
    return true;
  });
}

function AnnouncementPanel({ total, readable, genres }: { total: number; readable: number; genres: string[] }) {
  return (
    <aside className="border-l-[3px] border-cyan-400 bg-[#2a3134] px-6 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <h1 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7778]">Gomic</h1>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-[#cdd5d6] marker:text-[#6f7778]">
        <li>{total} title tersedia di catalog lokal, {readable} sudah punya chapter readable.</li>
        <li>Gunakan Browse untuk filter genre/status, atau lanjut baca dari progress lokal kalau ada.</li>
        <li>{genres.length ? `Genre aktif: ${genres.slice(0, 6).join(", ")}.` : "Genre akan muncul setelah metadata tersedia."}</li>
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/series" className="rounded bg-cyan-500 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-400">Browse</Link>
        <Link href="/library" className="rounded bg-[#202527] px-3 py-2 text-xs font-bold text-[#cdd5d6] hover:text-white">Library</Link>
        <Link href="/admin" className="rounded bg-[#202527] px-3 py-2 text-xs font-bold text-[#cdd5d6] hover:text-white">Admin</Link>
      </div>
    </aside>
  );
}

function PosterRail({ title, suffix, seriesList }: { title: string; suffix: string; seriesList: SeriesSummary[] }) {
  return (
    <section className="min-w-0">
      <SectionHeader title={title} suffix={suffix} />
      {seriesList.length ? (
        <div className="-mx-1 flex gap-[14px] overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {seriesList.map((series, index) => (
            <PosterCard key={series.slug} series={series} rank={index + 1} />
          ))}
        </div>
      ) : (
        <EmptyState title="Rail masih kosong" description="Data catalog belum cukup untuk mengisi section ini." />
      )}
    </section>
  );
}

function PosterCard({ series, rank }: { series: SeriesSummary; rank: number }) {
  const latest = series.latestChapter;

  return (
    <Link href={`/series/${series.slug}`} className="group flex w-[181px] shrink-0 flex-col text-[#cdd5d6]">
      <span className="relative block h-[253px] overflow-hidden rounded-sm bg-[#2a3134]">
        {series.coverUrl ? <span className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : null}
        <span className="absolute left-2 top-2 flex min-w-7 items-center justify-center rounded bg-black/65 px-2 py-1 text-xs font-bold text-white">{rank}</span>
        <span className="absolute right-2 top-2 grid h-[26px] w-[26px] place-items-center rounded bg-black/60 text-sm text-white opacity-0 transition group-hover:opacity-100">+</span>
      </span>
      <span className="flex min-h-[62px] flex-col gap-1 px-0.5 pt-2">
        <span className="flex items-center justify-between gap-3 text-xs text-[#6f7778]">
          <span className="truncate text-[#9da4a5]">{latest?.numberLabel ?? `${series.chapterCount} ch`}</span>
          <span className="shrink-0 text-[11px]">{latest ? formatDate(latest.publishedAt) : formatDate(series.updatedAt)}</span>
        </span>
        <span className="line-clamp-2 text-sm leading-[18px] text-[#cdd5d6] group-hover:text-white">{series.title}</span>
      </span>
    </Link>
  );
}

function UpdateGrid({ updates }: { updates: Array<{ series: SeriesSummary; chapter: ChapterSummary }> }) {
  return (
    <section>
      <SectionHeader title="Latest Updates" />
      {updates.length ? (
        <div className="grid grid-cols-2 gap-x-[14px] gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {updates.map(({ series, chapter }, index) => (
            <UpdatePoster key={`${series.slug}-${chapter.slug}`} series={series} chapter={chapter} rank={index + 1} />
          ))}
        </div>
      ) : (
        <EmptyState title="Belum ada update" description="Chapter readable akan tampil di Latest Updates setelah import selesai." />
      )}
    </section>
  );
}

function UpdatePoster({ series, chapter, rank }: { series: SeriesSummary; chapter: ChapterSummary; rank: number }) {
  return (
    <Link href={`/series/${series.slug}/${chapter.slug}`} className="group flex min-w-0 flex-col text-[#cdd5d6]">
      <span className="relative block aspect-[181/253] overflow-hidden rounded-sm bg-[#2a3134]">
        {series.coverUrl ? <span className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : null}
        <span className="absolute left-2 top-2 flex min-w-7 items-center justify-center rounded bg-black/65 px-2 py-1 text-xs font-bold text-white">{rank}</span>
      </span>
      <span className="flex min-h-[62px] flex-col gap-1 pt-2">
        <span className="flex items-center justify-between gap-2 text-xs text-[#6f7778]">
          <span className="truncate text-[#9da4a5]">{chapter.numberLabel}</span>
          <span className="shrink-0 text-[11px]">{formatDate(chapter.publishedAt)}</span>
        </span>
        <span className="line-clamp-2 text-sm leading-[18px] group-hover:text-white">{series.title}</span>
      </span>
    </Link>
  );
}

function BrowsePanel({ genres }: { genres: string[] }) {
  return (
    <section className="bg-[#2a3134] p-5">
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7778]">Discover</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {genres.length ? genres.map((genre) => (
          <Link key={genre} href={`/series?genre=${encodeURIComponent(genre)}`} className="rounded bg-[#202527] px-2.5 py-1.5 text-xs text-[#cdd5d6] hover:bg-cyan-500 hover:text-white">
            {genre}
          </Link>
        )) : <span className="text-sm text-[#6f7778]">Genre belum tersedia.</span>}
      </div>
    </section>
  );
}

function CompactList({ title, seriesList }: { title: string; seriesList: SeriesSummary[] }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold text-[#cdd5d6]">{title}</h2>
      <div className="space-y-3">
        {seriesList.length ? seriesList.map((series, index) => (
          <Link key={series.slug} href={`/series/${series.slug}`} className="group grid grid-cols-[48px_minmax(0,1fr)] gap-3">
            <span className="relative aspect-[3/4] overflow-hidden bg-[#2a3134]">
              {series.coverUrl ? <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : null}
            </span>
            <span className="min-w-0 border-b border-[#30383a] pb-3">
              <span className="block truncate text-sm text-[#cdd5d6] group-hover:text-white">{series.title}</span>
              <span className="mt-1 block text-xs text-[#6f7778]">#{index + 1} · {series.latestChapter?.numberLabel ?? `${series.chapterCount} ch`}</span>
            </span>
          </Link>
        )) : <p className="text-sm text-[#6f7778]">Belum ada data.</p>}
      </div>
    </section>
  );
}

function SectionHeader({ title, suffix }: { title: string; suffix?: string }) {
  return (
    <div className="mb-[18px] flex h-[34px] items-center justify-between">
      <h2 className="text-xl font-semibold text-[#cdd5d6]">
        {title}{suffix ? <span className="ml-2 text-[#6f7778]">{suffix}</span> : null}
      </h2>
      <Link href="/series" className="text-xs font-bold uppercase tracking-wide text-[#6f7778] hover:text-white">Browse</Link>
    </div>
  );
}
