import Link from "next/link";
import { ContinueReadingCard } from "@/components/continue-reading-card";
import { EmptyState } from "@/components/empty-state";
import { SeriesCard } from "@/components/series-card";
import { formatDate, titleCase } from "@/lib/format";
import { getAllGenres, getAllSeries, getFeaturedSeries, getRecentChapters } from "@/lib/catalog";

export default async function Home() {
  const featured = await getFeaturedSeries();
  const recent = (await getRecentChapters()).slice(0, 8);
  const allSeries = await getAllSeries();
  const readableSeries = allSeries.filter((series) => series.latestChapter && series.latestChapter.pageCount > 0);
  const partialCount = allSeries.filter((series) => series.latestChapter && series.latestChapter.pageCount === 0).length;
  const trending = [...readableSeries].sort((a, b) => b.chapterCount - a.chapterCount).slice(0, 4);
  const completed = allSeries.filter((series) => series.status === "completed");
  const genres = (await getAllGenres()).slice(0, 12);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(190,242,100,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.14),transparent_26%),linear-gradient(180deg,#050506,#08080b)]" />
        <div className="relative mx-auto grid min-h-[74vh] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-lime-200">
              Live catalog / multi-source imports
            </p>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              Manga reader yang langsung hidup dari hasil import.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              KomikCast, KomikIndo, progress lokal, source badge, dan reader fallback sekarang nyambung dari catalog sampai halaman baca.
            </p>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <Stat label="Catalog" value={allSeries.length.toString()} />
              <Stat label="Readable" value={readableSeries.length.toString()} />
              <Stat label="Partial" value={partialCount.toString()} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/series" className="rounded-full bg-lime-300 px-6 py-3 font-black text-black transition hover:bg-lime-200">
                Browse Series
              </Link>
              <Link href="/library" className="rounded-full border border-white/15 px-6 py-3 font-black text-white transition hover:bg-white/10">
                Library
              </Link>
            </div>
            <ContinueReadingCard seriesList={allSeries} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.slice(0, 4).map((series) => (
              <SeriesCard key={series.slug} series={series} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/25 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader kicker="Latest updates" title="Chapter terbaru" href="/series" />
          {recent.length ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {recent.map(({ series, chapter }) => (
                <Link
                  key={`${series.slug}-${chapter.slug}`}
                  href={`/series/${series.slug}/${chapter.slug}`}
                  className="group rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-4 shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:border-lime-300/40 hover:bg-white/[0.07]"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{formatDate(chapter.publishedAt)}</p>
                  <h3 className="mt-3 line-clamp-1 font-black text-white group-hover:text-lime-100">{series.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{chapter.numberLabel} / {chapter.title || "Untitled chapter"}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Belum ada readable chapter" description="Import chapter dengan pages dulu supaya latest updates terisi." />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader kicker="Trending" title="Paling banyak chapter" href="/series" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trending.map((series) => (
            <SeriesCard key={series.slug} series={series} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[radial-gradient(circle_at_18%_20%,rgba(190,242,100,0.1),transparent_30%),rgba(255,255,255,0.03)] py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-300">Genre rail</p>
            <h2 className="mt-2 text-3xl font-black text-white">Jalur cepat buat eksplor catalog.</h2>
            <p className="mt-4 text-zinc-400">Rail ini langsung buka catalog dengan filter genre dari data API/imported series.</p>
          </div>
          <div className="flex flex-wrap content-start gap-3">
            {genres.map((genre) => (
              <Link
                key={genre}
                href={`/series?genre=${encodeURIComponent(genre)}`}
                className="rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-lime-300/50 hover:bg-lime-300/10 hover:text-lime-100"
              >
                {genre}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader kicker="Completed" title="Bacaan tamat" href="/series" />
        {completed.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((series) => (
              <Link
                key={series.slug}
                href={`/series/${series.slug}`}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-lime-300/40 hover:bg-white/[0.07]"
              >
                <p className="text-sm font-black uppercase tracking-[0.2em] text-lime-300">{titleCase(series.type)} / {series.chapterCount} chapters</p>
                <h3 className="mt-3 text-2xl font-black text-white">{series.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{series.synopsis || "Belum ada synopsis dari source ini."}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Belum ada completed title" description="Begitu status completed ditambah dari API/source, section ini otomatis keisi." />
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-xl shadow-black/10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function SectionHeader({ kicker, title, href }: { kicker: string; title: string; href: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-300">{kicker}</p>
        <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
      </div>
      <Link href={href} className="text-sm font-black text-zinc-300 hover:text-lime-200">
        Lihat semua
      </Link>
    </div>
  );
}
