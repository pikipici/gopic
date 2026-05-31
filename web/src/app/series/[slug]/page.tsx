import Link from "next/link";
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
    title: series ? `${series.title} — Gomic` : "Series — Gomic",
    description: series?.synopsis,
  };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);

  if (!series) {
    notFound();
  }

  const readableChapters = series.chapters.filter((chapter) => chapter.pageCount > 0).length;
  const partialChapters = series.chapters.length - readableChapters;
  const firstReadable = series.chapters.find((chapter) => chapter.pageCount > 0);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-30 blur-2xl" style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(190,242,100,0.2),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.35),#07070a_72%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[340px_1fr] lg:px-8 lg:py-14">
          <div className="relative">
            <div className="absolute -inset-3 rounded-[2.25rem] bg-lime-300/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
              <div className="aspect-[3/4] bg-cover bg-center" style={{ backgroundImage: `url(${series.coverUrl})` }} />
            </div>
          </div>
          <div className="flex flex-col justify-end rounded-[2rem] border border-white/10 bg-black/40 p-6 shadow-2xl shadow-black/25 backdrop-blur-md sm:p-8">
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.18em]">
              <span className={`rounded-full border px-3 py-1 ${sourceClass(series.sourceId)}`}>{sourceLabel(series.sourceId)}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-zinc-200">
                {titleCase(series.type)} / {titleCase(series.status)} / {series.releaseYear}
              </span>
              <span className="rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-lime-100">
                {readableChapters} readable
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black leading-none text-white sm:text-6xl">{series.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">{series.synopsis || "Belum ada synopsis dari source ini."}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {series.genres.length ? (
                series.genres.map((genre) => (
                  <span key={genre} className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-300">
                    {genre}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-zinc-500">No genres</span>
              )}
            </div>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetaTile label="Author" value={series.authorName || "Unknown"} />
              <MetaTile label="Artist" value={series.artistName || "Unknown"} />
              <MetaTile label="Rating" value={titleCase(series.contentRating)} />
              <MetaTile label="Updated" value={formatDate(series.updatedAt)} />
            </dl>
            {firstReadable ? (
              <Link
                href={`/series/${series.slug}/${firstReadable.slug}`}
                className="mt-8 inline-flex w-fit rounded-full bg-lime-300 px-6 py-3 font-black text-black transition hover:bg-lime-200"
              >
                Start reading {firstReadable.numberLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-4 sm:flex sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-300">Episodes</p>
              <h2 className="mt-2 text-2xl font-black text-white">Chapter list</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold sm:mt-0">
              <span className="rounded-full bg-lime-300 px-3 py-1 text-black">{readableChapters}/{series.chapters.length} ready</span>
              {partialChapters ? <span className="rounded-full bg-amber-300/15 px-3 py-1 text-amber-100">{partialChapters} partial</span> : null}
            </div>
          </div>
          {partialChapters ? (
            <div className="mx-4 mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm text-amber-100 sm:mx-6">
              Beberapa chapter hasil import belum punya pages. Series tetap tampil di katalog, tapi chapter itu tidak dibuka sampai pages tersedia.
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

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="mt-1 line-clamp-2 font-semibold text-white">{value}</dd>
    </div>
  );
}
