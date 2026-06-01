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
          detailHref={`/series/${series.slug}`}
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
    <section className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(190,242,100,0.12),transparent_26%),linear-gradient(180deg,#050506,#000)]" />
      <div className="relative w-full max-w-3xl rounded-[2rem] border border-amber-200/20 bg-amber-200/10 p-6 text-center text-amber-100 shadow-2xl shadow-black/40 sm:p-8">
        <Link href={`/series/${seriesSlug}`} className="text-sm font-black text-lime-200 hover:text-lime-100">
          Back to {seriesTitle}
        </Link>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-amber-200">Pages unavailable</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">{chapterLabel}</h1>
        <p className="mt-2 text-lg font-semibold text-zinc-200">{chapterTitle || "Untitled chapter"}</p>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-amber-100/85">
          Metadata chapter sudah masuk dari source, tapi fetch pages belum berhasil. Chapter ini sengaja tidak dibuat blank supaya partial import kelihatan jelas.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {previousHref ? (
            <Link href={previousHref} className="rounded-full border border-white/15 px-5 py-3 text-sm font-black text-white hover:bg-white/10">
              Previous readable
            </Link>
          ) : null}
          <Link href={`/series/${seriesSlug}`} className="rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black hover:bg-lime-200">
            Back to detail
          </Link>
          {nextHref ? (
            <Link href={nextHref} className="rounded-full border border-white/15 px-5 py-3 text-sm font-black text-white hover:bg-white/10">
              Next readable
            </Link>
          ) : null}
          <Link href="/admin" className="rounded-full border border-amber-200/30 px-5 py-3 text-sm font-black text-amber-100 hover:bg-amber-200/10">
            Open admin
          </Link>
        </div>
      </div>
    </section>
  );
}
