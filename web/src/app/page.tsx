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
  const trending = [...allSeries].sort((a, b) => b.chapterCount - a.chapterCount).slice(0, 4);
  const completed = allSeries.filter((series) => series.status === "completed");
  const genres = (await getAllGenres()).slice(0, 12);

  return (
    <main>
      <section className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-2 text-sm font-semibold text-lime-200">
            Fase 2 · reader UX polish
          </p>
          <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
            Reader manga gelap, cepat, dan mobile-first.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Catalog filter, local reading progress, dan reader settings sudah jalan di seed data sebelum Go API + PostgreSQL masuk.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/series" className="rounded-full bg-lime-300 px-6 py-3 font-bold text-black transition hover:bg-lime-200">
              Browse Series
            </Link>
            <Link href="/library" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/10">
              Library
            </Link>
          </div>
          <ContinueReadingCard seriesList={allSeries} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {featured.map((series) => (
            <SeriesCard key={series.slug} series={series} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/20 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader kicker="Latest updates" title="Chapter terbaru" href="/series" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {recent.map(({ series, chapter }) => (
              <Link
                key={`${series.slug}-${chapter.slug}`}
                href={`/series/${series.slug}/${chapter.slug}`}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-lime-300/40 hover:bg-white/[0.07]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{formatDate(chapter.publishedAt)}</p>
                <h3 className="mt-3 line-clamp-1 font-bold text-white">{series.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{chapter.numberLabel} · {chapter.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader kicker="Trending" title="Paling rame di seed" href="/series" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trending.map((series) => (
            <SeriesCard key={series.slug} series={series} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">Genre rail</p>
            <h2 className="mt-2 text-3xl font-black text-white">Jalur cepat buat eksplor catalog.</h2>
            <p className="mt-4 text-zinc-400">Rail ini masih link ke catalog global. Fase berikutnya bisa sync ke query params filter.</p>
          </div>
          <div className="flex flex-wrap content-start gap-3">
            {genres.map((genre) => (
              <Link
                key={genre}
                href={`/series?genre=${encodeURIComponent(genre)}`}
                className="rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-lime-300/50 hover:text-lime-200"
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
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-300">{titleCase(series.type)} · {series.chapterCount} chapters</p>
                <h3 className="mt-3 text-2xl font-black text-white">{series.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{series.synopsis}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Belum ada completed title" description="Seed data sekarang belum punya title tamat. Begitu status completed ditambah, section ini otomatis keisi." />
        )}
      </section>
    </main>
  );
}

function SectionHeader({ kicker, title, href }: { kicker: string; title: string; href: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">{kicker}</p>
        <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
      </div>
      <Link href={href} className="text-sm font-semibold text-zinc-300 hover:text-lime-200">
        Lihat semua
      </Link>
    </div>
  );
}
