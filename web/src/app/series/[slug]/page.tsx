import Link from "next/link";
import { notFound } from "next/navigation";
import { ChapterList } from "@/components/chapter-list";
import { getAllSeries, getSeedStaticParams, getSeriesBySlug } from "@/lib/catalog";
import { formatDate, titleCase } from "@/lib/format";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getSeedStaticParams();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);

  return {
    title: series ? `${series.title} - Gomic` : "Series - Gomic",
    description: series?.synopsis,
  };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [series, allSeries] = await Promise.all([getSeriesBySlug(slug), getAllSeries()]);

  if (!series) {
    notFound();
  }

  const readableChapters = series.chapters.filter((chapter) => chapter.pageCount > 0);
  const partialChapters = series.chapters.filter((chapter) => chapter.pageCount === 0);
  const firstReadable = readableChapters.at(-1) ?? readableChapters[0];
  const latestReadable = readableChapters[0];
  const totalPages = series.chapters.reduce((sum, chapter) => sum + chapter.pageCount, 0);
  const latestChapter = series.latestChapter ?? series.chapters[0];
  const topGenres = series.genres.slice(0, 8);
  const recommendations = allSeries.filter((item) => item.slug !== series.slug && item.coverUrl).slice(0, 5);
  const credits = [series.authorName, series.artistName].filter(Boolean).join(" / ");
  const rank = Math.max(1, allSeries.findIndex((item) => item.slug === series.slug) + 1);

  return (
    <main className="overflow-hidden bg-zinc-900 text-zinc-100">
      <section className="relative border-b border-zinc-700 bg-zinc-900">
        {series.coverUrl ? (
          <div className="absolute inset-0 opacity-20 blur-3xl" style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.72),#18181b_92%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="grid gap-5 rounded-lg border border-zinc-700 bg-zinc-800/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-md md:grid-cols-[220px_minmax(0,1fr)] lg:p-6">
            <aside className="mx-auto grid w-full max-w-[220px] gap-3 md:mx-0">
              <div className="overflow-hidden rounded-lg bg-zinc-950 shadow-xl shadow-black/35 ring-1 ring-zinc-700">
                {series.coverUrl ? <div className="aspect-[3/4] bg-cover bg-center" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : <div className="flex aspect-[3/4] items-center justify-center bg-white/[0.04] text-xs font-black uppercase tracking-[0.2em] text-zinc-600">No cover</div>}
              </div>
              <div className="grid gap-2">
                {firstReadable ? <ReadButton href={`/series/${series.slug}/${firstReadable.slug}`} label="Start Reading" primary /> : null}
                {latestReadable && latestReadable.slug !== firstReadable?.slug ? <ReadButton href={`/series/${series.slug}/${latestReadable.slug}`} label={`Latest ${latestReadable.numberLabel}`} /> : null}
                <button type="button" className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-cyan-400 hover:text-cyan-300">Follow ›</button>
                <div className="flex justify-center gap-1 text-lg text-yellow-400" aria-label="rating stars"><span>☆</span><span>☆</span><span>☆</span><span>☆</span><span>☆</span></div>
                <Link href="/series" className="text-center text-xs font-medium text-zinc-400 transition hover:text-cyan-300">Edit history</Link>
              </div>
            </aside>

            <section className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400"><Link href="/" className="hover:text-cyan-300">Home</Link> <span className="px-1.5">/</span> <Link href="/series" className="hover:text-cyan-300">{titleCase(series.type)}</Link></div>

            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-zinc-100 sm:text-4xl">{series.title}</h1>

            {series.altTitles.length ? <p className="mt-2 line-clamp-1 text-sm font-medium text-zinc-400">Alternative names ▾ {series.altTitles.slice(0, 3).join(" / ")}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.12em]">
              <span className="rounded border border-blue-400/20 bg-blue-950/70 px-2.5 py-1 text-blue-300">{titleCase(series.type)}</span>
              <span className="rounded border border-green-400/20 bg-green-950/70 px-2.5 py-1 text-green-300">{titleCase(series.contentRating)}</span>
              {series.releaseYear ? <span className="rounded border border-zinc-600 bg-zinc-700 px-2.5 py-1 text-zinc-300">{series.releaseYear}</span> : null}
              <span className="rounded border border-green-400/20 bg-green-950/40 px-2.5 py-1 text-green-300"><span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-green-400" />{titleCase(series.status)}</span>
            </div>

            <p className="mt-3 text-sm font-medium text-zinc-400">#{rank} · ★ 7.{Math.min(9, readableChapters.length + 1)} by {Math.max(24, totalPages)} readers · {readableChapters.length} chapters followed</p>

            <dl className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Fact label="Chapters" value={series.chapters.length.toString()} />
              <Fact label="Pages" value={totalPages.toString()} />
              <Fact label="Updated" value={formatDate(series.updatedAt)} />
              <Fact label="Latest" value={latestChapter?.numberLabel ?? "None"} />
            </dl>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_17rem]">
              <section className="rounded-lg border border-zinc-700 bg-zinc-900/55 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Synopsis</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">
                  {series.synopsis || "Belum ada synopsis untuk title ini. Detail tetap bisa dipakai untuk cek chapter dan status import."}
                </p>
                <span className="mt-2 inline-block text-sm font-medium text-cyan-400">view more</span>
              </section>

              <section className="rounded-lg border border-zinc-700 bg-zinc-900/55 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Info</h2>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-1">
                  <KeyValue label="Credits" value={credits || "Unknown"} />
                  <KeyValue label="Demographic" value={titleCase(series.demographic)} />
                  <KeyValue label="Rating" value={titleCase(series.contentRating)} />
                  <KeyValue label="Updated" value={formatDate(series.updatedAt)} />
                </div>
              </section>
            </div>

            {topGenres.length ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Genres</p>
                <div className="flex flex-wrap gap-2">
                {topGenres.map((genre) => (
                  <Link key={genre} href={`/series?genre=${encodeURIComponent(genre)}`} className="rounded-full border border-zinc-600 bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:border-cyan-400 hover:text-cyan-300">
                    {genre}
                  </Link>
                ))}
                </div>
              </div>
            ) : null}
            </section>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl shadow-black/20">
          <div className="border-b border-zinc-700 bg-zinc-800 p-4 sm:flex sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Chapters</h2>
              <p className="mt-1 text-xs text-zinc-400">Showing {Math.min(series.chapters.length, 20)} of {series.chapters.length} items</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold sm:mt-0">
              <span className="rounded-md bg-cyan-500 px-2.5 py-1 text-white">{readableChapters.length}/{series.chapters.length} ready</span>
              {partialChapters.length ? <span className="rounded-md bg-amber-300/15 px-2.5 py-1 text-amber-100">{partialChapters.length} partial</span> : null}
            </div>
          </div>
          {partialChapters.length ? (
            <div className="mx-4 mt-4 rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2.5 text-sm leading-6 text-amber-100">
              {partialChapters.length} chapter masih partial: metadata sudah masuk, tapi page count masih 0. Chapter ditandai `Partial import` dan tidak dibuka sampai pages tersedia lewat sync chapter pages atau upload admin.
            </div>
          ) : null}
          <div className="p-4">
            <ChapterList series={series} />
          </div>
        </div>
        <Recommendations items={recommendations} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
          <div className="border-l-4 border-cyan-400 bg-cyan-500/10 px-3 py-2 text-sm text-zinc-300">Note: Please take a moment to read the comment rules before posting.</div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">17 comments</h2>
            <div className="flex gap-2 text-xs font-bold"><span className="rounded bg-zinc-700 px-2.5 py-1 text-zinc-100">Best</span><span className="px-2.5 py-1 text-zinc-400">Newest</span><span className="px-2.5 py-1 text-zinc-400">Oldest</span></div>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-700 text-sm font-bold text-white">G</div>
            <div className="min-h-24 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">Share your thoughts about this series...</div>
          </div>
          <CommentPreview initial="Z" name="Zadamy" text="Clean title page, tinggal lanjut baca chapter terbaru." />
        </div>
      </section>
    </main>
  );
}

function ReadButton({ href, label, primary, compact }: { href: string; label: string; primary?: boolean; compact?: boolean }) {
  const className = primary
    ? "rounded-md bg-cyan-500 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-cyan-600"
    : compact
      ? "rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-center text-xs font-bold text-zinc-200 transition hover:border-cyan-400 hover:text-cyan-300"
      : "rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-center text-sm font-bold text-zinc-200 transition hover:border-cyan-400 hover:text-cyan-300";
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/55 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</dt>
      <dd className="mt-1 truncate text-base font-bold text-zinc-100 sm:text-lg">{value}</dd>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1 break-words font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function Recommendations({ items }: { items: Awaited<ReturnType<typeof getAllSeries>> }) {
  return (
    <aside className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">Recommendations</h2>
        <div className="flex gap-1 text-zinc-400"><span>‹</span><span>›</span></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((item, index) => (
          <Link key={item.slug} href={`/series/${item.slug}`} className="grid grid-cols-[60px_minmax(0,1fr)] gap-3 rounded-md border border-transparent p-1 transition hover:border-zinc-700 hover:bg-zinc-700/40">
            <div className="aspect-[3/4] rounded bg-cover bg-center" style={{ backgroundImage: `url(${item.coverUrl})` }} />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium text-zinc-100">{item.title}</p>
              <p className="mt-2 text-xs text-zinc-400">▲ {9 - Math.min(index, 5)} ▼</p>
            </div>
          </Link>
        ))}
      </div>
      <button type="button" className="mt-4 w-full rounded-md border border-dashed border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-400 transition hover:border-cyan-400 hover:text-cyan-300">+ Add recommendation</button>
    </aside>
  );
}

function CommentPreview({ initial, name, text }: { initial: string; name: string; text: string }) {
  return (
    <div className="mt-5 flex gap-3 border-t border-zinc-700 pt-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-purple-700 text-sm font-bold text-white">{initial}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-100">{name} <span className="ml-2 text-xs font-normal text-zinc-500">3mos ago</span></p>
        <p className="mt-1 line-clamp-4 text-sm leading-6 text-zinc-300">{text}</p>
        <p className="mt-2 text-xs text-zinc-500">👍 243 · 💬 71 · More</p>
      </div>
    </div>
  );
}
