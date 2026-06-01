import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ChapterList } from "@/components/chapter-list";
import { getSeedStaticParams, getSeriesBySlug } from "@/lib/catalog";
import { formatDate, titleCase } from "@/lib/format";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function sourceLabel(sourceId?: string) {
  if (sourceId === "komikcast") return "KomikCast";
  if (sourceId === "komikindo") return "KomikIndo";
  if (sourceId === "mock-mihon") return "Mock source";
  return "Seed catalog";
}

function sourceClass(sourceId?: string) {
  if (sourceId === "komikcast") return "border-sky-300/30 bg-sky-300/15 text-sky-100";
  if (sourceId === "komikindo") return "border-amber-300/30 bg-amber-300/15 text-amber-100";
  if (sourceId === "mock-mihon") return "border-fuchsia-300/30 bg-fuchsia-300/15 text-fuchsia-100";
  return "border-white/15 bg-white/10 text-white";
}

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

  return (
    <main className="overflow-hidden bg-[#050506]">
      <section className="relative border-b border-white/10">
        {series.coverUrl ? (
          <div className="absolute inset-0 opacity-25 blur-3xl" style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_8%,rgba(190,242,100,0.18),transparent_28%),radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.11),transparent_24%),linear-gradient(180deg,rgba(0,0,0,0.22),#050506_78%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem] lg:px-8 lg:py-10">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="relative mx-auto max-w-72 lg:max-w-none">
              <div className="absolute -inset-3 rounded-[2.25rem] bg-lime-300/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
                {series.coverUrl ? (
                  <div className="aspect-[3/4] bg-cover bg-center" style={{ backgroundImage: `url(${series.coverUrl})` }} />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center bg-white/[0.04] text-sm font-black uppercase tracking-[0.2em] text-zinc-600">No cover</div>
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/10 bg-black/45 p-5 shadow-2xl shadow-black/25 backdrop-blur-md sm:p-7 lg:p-8">
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.18em]">
              <span className={`rounded-full border px-3 py-1 ${sourceClass(series.sourceId)}`}>{sourceLabel(series.sourceId)}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-zinc-200">{titleCase(series.type)}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-zinc-200">{titleCase(series.status)}</span>
              <span className="rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-lime-100">{readableChapters.length} readable</span>
            </div>

            <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">{series.title}</h1>

            {series.altTitles.length ? <p className="mt-3 line-clamp-1 text-sm text-zinc-500">Also known as: {series.altTitles.slice(0, 3).join(" / ")}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {firstReadable ? <ReadButton href={`/series/${series.slug}/${firstReadable.slug}`} label={`Start ${firstReadable.numberLabel}`} primary /> : null}
              {latestReadable && latestReadable.slug !== firstReadable?.slug ? <ReadButton href={`/series/${series.slug}/${latestReadable.slug}`} label={`Latest ${latestReadable.numberLabel}`} /> : null}
              <ReadButton href="/series" label="Back to catalog" />
            </div>

            <dl className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="Chapters" value={series.chapters.length.toString()} />
              <Fact label="Pages" value={totalPages.toString()} />
              <Fact label="Partial" value={partialChapters.length.toString()} />
              <Fact label="Updated" value={formatDate(series.updatedAt)} />
            </dl>

            <section className="mt-7 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-lime-300">Synopsis</h2>
                <span className="text-xs font-bold text-zinc-500">{series.releaseYear || "Unknown year"}</span>
              </div>
              <p className="mt-4 line-clamp-6 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
                {series.synopsis || "Belum ada synopsis dari source ini. Detail tetap bisa dipakai untuk cek chapter dan status import."}
              </p>
            </section>

            {topGenres.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {topGenres.map((genre) => (
                  <Link key={genre} href={`/series?genre=${encodeURIComponent(genre)}`} className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-lime-100">
                    {genre}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <InfoPanel title="Import Source">
              <div className="space-y-3 text-sm">
                <KeyValue label="Source" value={sourceLabel(series.sourceId)} />
                <KeyValue label="Source ID" value={series.sourceSeriesId || "Not provided"} />
                <KeyValue label="Last sync" value={series.lastSyncedAt ? formatDate(series.lastSyncedAt) : "Unknown"} />
                {series.sourceUrl ? (
                  <a href={series.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-black/25 px-4 py-3 font-bold text-zinc-200 transition hover:border-lime-300/40 hover:text-lime-100">
                    Open source URL
                  </a>
                ) : null}
              </div>
            </InfoPanel>

            <InfoPanel title="Chapter State">
              <div className="grid grid-cols-2 gap-3">
                <MiniFact label="Ready" value={readableChapters.length.toString()} tone="lime" />
                <MiniFact label="Partial" value={partialChapters.length.toString()} tone="amber" />
                <MiniFact label="Pages" value={totalPages.toString()} tone="sky" />
                <MiniFact label="Latest" value={latestChapter?.numberLabel ?? "None"} tone="zinc" />
              </div>
            </InfoPanel>

            {series.authorName || series.artistName || series.demographic ? (
              <InfoPanel title="Credits">
                <div className="space-y-3 text-sm">
                  <KeyValue label="Author" value={series.authorName || "Unknown"} />
                  <KeyValue label="Artist" value={series.artistName || "Unknown"} />
                  <KeyValue label="Demographic" value={titleCase(series.demographic)} />
                  <KeyValue label="Rating" value={titleCase(series.contentRating)} />
                </div>
              </InfoPanel>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-4 sm:flex sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-300">Chapters</p>
              <h2 className="mt-2 text-2xl font-black text-white">Read list</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold sm:mt-0">
              <span className="rounded-full bg-lime-300 px-3 py-1 text-black">{readableChapters.length}/{series.chapters.length} ready</span>
              {partialChapters.length ? <span className="rounded-full bg-amber-300/15 px-3 py-1 text-amber-100">{partialChapters.length} partial</span> : null}
            </div>
          </div>
          {partialChapters.length ? (
            <div className="mx-4 mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm leading-6 text-amber-100 sm:mx-6">
              Beberapa chapter hasil import belum punya pages. Chapter itu ditandai partial dan tidak dibuka sampai pages tersedia.
            </div>
          ) : null}
          <div className="p-4 sm:p-6">
            <ChapterList series={series} />
          </div>
        </div>
      </section>
    </main>
  );
}

function ReadButton({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  const className = primary
    ? "rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black transition hover:bg-lime-200"
    : "rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/10";
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <dt className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="mt-1 truncate text-xl font-black text-white">{value}</dd>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15">
      <h2 className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function MiniFact({ label, value, tone }: { label: string; value: string; tone: "lime" | "amber" | "sky" | "zinc" }) {
  const toneClass = tone === "lime" ? "text-lime-200" : tone === "amber" ? "text-amber-200" : tone === "sky" ? "text-sky-200" : "text-zinc-200";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={`mt-1 truncate text-lg font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
