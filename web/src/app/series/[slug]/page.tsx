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

  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-25 blur-2xl" style={{ backgroundImage: `url(${series.coverUrl})`, backgroundSize: "cover" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#07070a]/80 to-[#07070a]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8 lg:py-14">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/30">
            <div className="aspect-[3/4] bg-cover bg-center" style={{ backgroundImage: `url(${series.coverUrl})` }} />
          </div>
          <div className="flex flex-col justify-end rounded-[2rem] border border-white/10 bg-black/35 p-6 backdrop-blur-md sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">
              {titleCase(series.type)} · {titleCase(series.status)} · {series.releaseYear}
            </p>
            <h1 className="mt-4 text-4xl font-black text-white sm:text-6xl">{series.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">{series.synopsis}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {series.genres.map((genre) => (
                <span key={genre} className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-300">
                  {genre}
                </span>
              ))}
            </div>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Author</dt>
                <dd className="mt-1 font-semibold text-white">{series.authorName}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Artist</dt>
                <dd className="mt-1 font-semibold text-white">{series.artistName}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Rating</dt>
                <dd className="mt-1 font-semibold text-white">{titleCase(series.contentRating)}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Updated</dt>
                <dd className="mt-1 font-semibold text-white">{formatDate(series.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-black/20 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">Episodes</p>
              <h2 className="mt-2 text-2xl font-black text-white">Chapter list</h2>
            </div>
            <p className="text-sm text-zinc-500">{series.chapters.length} chapters tersedia</p>
          </div>
          <ChapterList series={series} />
        </div>
      </section>
    </main>
  );
}
