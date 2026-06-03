import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderShell } from "@/components/reader-shell";
import { getChapter, getSeedChapterStaticParams, getSeriesBySlug } from "@/lib/catalog";

type PageProps = {
  params: Promise<{ slug: string; chapterSlug: string }>;
};

export function generateStaticParams() {
  return getSeedChapterStaticParams();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, chapterSlug } = await params;
  const record = await getChapter(slug, chapterSlug);

  return {
    title: record ? `${record.series.title} ${record.chapter.numberLabel} - Gomic` : "Reader - Gomic",
  };
}

export default async function ReaderPage({ params }: PageProps) {
  const { slug, chapterSlug } = await params;
  const record = await getChapter(slug, chapterSlug);

  if (!record) {
    notFound();
  }

  const { series, chapter } = record;
  const seriesDetail = await getSeriesBySlug(series.slug);
  const readableChapters = seriesDetail?.chapters.filter((item) => item.pageCount > 0) ?? [];
  const chapterIndex = readableChapters.findIndex((item) => item.slug === chapter.slug);
  const previous = chapterIndex >= 0 ? readableChapters[chapterIndex + 1] : undefined;
  const next = chapterIndex >= 0 ? readableChapters[chapterIndex - 1] : undefined;
  const hasPages = chapter.pages.length > 0;

  return (
    <main className="min-h-screen bg-black">
      {hasPages ? (
        <ReaderShell
          pages={chapter.pages}
          seriesSlug={series.slug}
          seriesTitle={series.title}
          chapterSlug={chapter.slug}
          chapterTitle={chapter.title}
          chapterLabel={chapter.numberLabel}
          chapterLinks={readableChapters.map((item) => ({ slug: item.slug, label: item.numberLabel, title: item.title, href: `/series/${series.slug}/${item.slug}` }))}
          detailHref={`/series/${series.slug}`}
          sourceLabel={seriesDetail?.sourceId ? `${seriesDetail.sourceId} source` : "Local source"}
          sourceHref={seriesDetail?.sourceUrl}
          previousHref={previous ? `/series/${series.slug}/${previous.slug}` : undefined}
          previousLabel={previous?.numberLabel}
          nextHref={next ? `/series/${series.slug}/${next.slug}` : undefined}
          nextLabel={next?.numberLabel}
        />
      ) : (
        <NoPagesState
          seriesSlug={series.slug}
          seriesTitle={series.title}
          chapterLabel={chapter.numberLabel}
          chapterTitle={chapter.title}
          previousHref={previous ? `/series/${series.slug}/${previous.slug}` : undefined}
          nextHref={next ? `/series/${series.slug}/${next.slug}` : undefined}
        />
      )}
    </main>
  );
}

function NoPagesState({
  seriesSlug,
  seriesTitle,
  chapterLabel,
  chapterTitle,
  previousHref,
  nextHref,
}: {
  seriesSlug: string;
  seriesTitle: string;
  chapterLabel: string;
  chapterTitle: string;
  previousHref?: string;
  nextHref?: string;
}) {
  return (
    <section className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0f0f0f] px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#18181b,#0f0f0f)]" />
      <div className="relative w-full max-w-3xl rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center text-zinc-300 shadow-2xl shadow-black/40 sm:p-8">
        <Link href={`/series/${seriesSlug}`} className="text-sm font-bold text-cyan-400 hover:text-cyan-300">
          Back to {seriesTitle}
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">Pages unavailable</p>
        <h1 className="mt-3 text-3xl font-bold text-zinc-100 sm:text-5xl">{chapterLabel}</h1>
        <p className="mt-2 text-lg font-semibold text-zinc-200">{chapterTitle || "Untitled chapter"}</p>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-zinc-400">
          Metadata chapter sudah masuk, tapi pages belum berhasil tersedia. Chapter ini sengaja tidak dibuat blank supaya partial import kelihatan jelas.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {previousHref ? (
            <Link href={previousHref} className="rounded-lg border border-zinc-600 bg-zinc-800 px-5 py-3 text-sm font-bold text-zinc-200 hover:bg-zinc-700">
              Previous readable
            </Link>
          ) : null}
          <Link href={`/series/${seriesSlug}`} className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-600">
            Back to detail
          </Link>
          {nextHref ? (
            <Link href={nextHref} className="rounded-lg border border-zinc-600 bg-zinc-800 px-5 py-3 text-sm font-bold text-zinc-200 hover:bg-zinc-700">
              Next readable
            </Link>
          ) : null}
          <Link href="/admin" className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-400 hover:border-cyan-400 hover:text-cyan-300">
            Open admin
          </Link>
        </div>
      </div>
    </section>
  );
}
