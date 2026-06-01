import Link from "next/link";
import { notFound } from "next/navigation";
import { ChapterList } from "@/components/chapter-list";
import { getSeedStaticParams, getSeriesBySlug } from "@/lib/catalog";
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
  const series = await getSeriesBySlug(slug);

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
  const credits = [series.authorName, series.artistName].filter(Boolean).join(" / ");

  return (
    <main className="overflow-hidden bg-[#050506]">
      <section className="relative border-b border-white/10 bg-[#09090b]">
        {series.coverUrl ? (
          <div className="absolute inset-0 opacity-20 blur-3xl" style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_8%,rgba(190,242,100,0.15),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.1),#050506_86%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-6 lg:py-6">
          <aside className="lg:sticky lg:top-16 lg:self-start">
            <div className="mx-auto max-w-52 rounded-xl border border-white/10 bg-[#111114] p-2 shadow-2xl shadow-black/40 sm:max-w-60 lg:max-w-none">
              <div className="overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-white/10">
                {series.coverUrl ? <div className="aspect-[3/4] bg-cover bg-center" style={{ backgroundImage: `url(${series.coverUrl})` }} /> : <div className="flex aspect-[3/4] items-center justify-center bg-white/[0.04] text-sm font-black uppercase tracking-[0.2em] text-zinc-600">No cover</div>}
              </div>
              <div className="mt-2 grid gap-2">
                {firstReadable ? <ReadButton href={`/series/${series.slug}/${firstReadable.slug}`} label={`Start ${firstReadable.numberLabel}`} primary /> : null}
                {latestReadable && latestReadable.slug !== firstReadable?.slug ? <ReadButton href={`/series/${series.slug}/${latestReadable.slug}`} label={`Latest ${latestReadable.numberLabel}`} /> : null}
                <ReadButton href="/series" label="Back to catalog" compact />
              </div>
            </div>
          </aside>

          <section className="min-w-0 rounded-xl border border-white/10 bg-[#111114]/90 p-4 shadow-xl shadow-black/25 backdrop-blur-md sm:p-5 lg:p-6">
            <div className="flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] sm:text-[11px]">
              <span className="rounded-md border border-white/10 bg-white/10 px-2.5 py-1 text-zinc-200">{titleCase(series.type)}</span>
              <span className="rounded-md border border-white/10 bg-white/10 px-2.5 py-1 text-zinc-200">{titleCase(series.status)}</span>
              <span className="rounded-md border border-lime-300/25 bg-lime-300/10 px-2.5 py-1 text-lime-100">{readableChapters.length} readable</span>
              {series.releaseYear ? <span className="rounded-md border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-300">{series.releaseYear}</span> : null}
            </div>

            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">{series.title}</h1>

            {series.altTitles.length ? <p className="mt-3 line-clamp-2 text-sm font-semibold text-zinc-500">Also known as: {series.altTitles.slice(0, 3).join(" / ")}</p> : null}

            <dl className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Fact label="Chapters" value={series.chapters.length.toString()} />
              <Fact label="Pages" value={totalPages.toString()} />
              <Fact label="Updated" value={formatDate(series.updatedAt)} />
              <Fact label="Latest" value={latestChapter?.numberLabel ?? "None"} />
            </dl>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <section className="rounded-lg border border-white/10 bg-black/25 p-4">
                <h2 className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Synopsis</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {series.synopsis || "Belum ada synopsis untuk title ini. Detail tetap bisa dipakai untuk cek chapter dan status import."}
                </p>
              </section>

              <section className="rounded-lg border border-white/10 bg-black/25 p-4">
                <h2 className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Info</h2>
                <div className="mt-3 space-y-2 text-sm">
                  <KeyValue label="Credits" value={credits || "Unknown"} />
                  <KeyValue label="Demographic" value={titleCase(series.demographic)} />
                  <KeyValue label="Rating" value={titleCase(series.contentRating)} />
                  <KeyValue label="Partial" value={partialChapters.length.toString()} />
                </div>
              </section>
            </div>

            {topGenres.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {topGenres.map((genre) => (
                  <Link key={genre} href={`/series?genre=${encodeURIComponent(genre)}`} className="rounded-md border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-lime-100">
                    {genre}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-5 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111114] shadow-xl shadow-black/20">
          <div className="border-b border-white/10 p-4 sm:flex sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-300">Chapters</p>
              <h2 className="mt-1 text-2xl font-black text-white">Daftar chapter</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold sm:mt-0">
              <span className="rounded-md bg-lime-300 px-2.5 py-1 text-black">{readableChapters.length}/{series.chapters.length} ready</span>
              {partialChapters.length ? <span className="rounded-md bg-amber-300/15 px-2.5 py-1 text-amber-100">{partialChapters.length} partial</span> : null}
            </div>
          </div>
          {partialChapters.length ? (
            <div className="mx-4 mt-4 rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2.5 text-sm leading-6 text-amber-100">
              Beberapa chapter hasil import belum punya pages. Chapter itu ditandai partial dan tidak dibuka sampai pages tersedia.
            </div>
          ) : null}
          <div className="p-4">
            <ChapterList series={series} />
          </div>
        </div>
      </section>
    </main>
  );
}

function ReadButton({ href, label, primary, compact }: { href: string; label: string; primary?: boolean; compact?: boolean }) {
  const className = primary
    ? "rounded-md bg-lime-300 px-4 py-2.5 text-center text-sm font-black text-black transition hover:bg-lime-200"
    : compact
      ? "rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-center text-xs font-black text-white transition hover:bg-white/10"
      : "rounded-md border border-white/15 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-white/10";
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <dt className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="mt-1 truncate text-base font-black text-white sm:text-lg">{value}</dd>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-zinc-200">{value}</p>
    </div>
  );
}
