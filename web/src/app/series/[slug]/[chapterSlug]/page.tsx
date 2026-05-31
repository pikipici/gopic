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
    title: record ? `${record.series.title} ${record.chapter.numberLabel} — Gomic` : "Reader — Gomic",
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
    <main className="min-h-screen bg-black pb-24">
      <div className="sticky top-16 z-30 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href={`/series/${series.slug}`} className="text-sm font-semibold text-lime-300 hover:text-lime-200">
              ← {series.title}
            </Link>
            <h1 className="mt-1 text-xl font-black text-white">{chapter.numberLabel} · {chapter.title}</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">Webtoon scroll · {chapter.pages.length} pages</p>
          </div>
          <div className="flex gap-2 text-sm font-semibold">
            {previous ? (
              <Link href={`/series/${series.slug}/${previous.slug}`} className="rounded-full border border-white/10 px-4 py-2 text-zinc-200 hover:bg-white/10">
                Prev
              </Link>
            ) : null}
            <Link href={`/series/${series.slug}`} className="rounded-full border border-white/10 px-4 py-2 text-zinc-200 hover:bg-white/10">
              Details
            </Link>
            {next ? (
              <Link href={`/series/${series.slug}/${next.slug}`} className="rounded-full bg-lime-300 px-4 py-2 text-black hover:bg-lime-200">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {hasPages ? (
        <ReaderShell pages={chapter.pages} seriesSlug={series.slug} chapterSlug={chapter.slug} />
      ) : (
        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="rounded-[2rem] border border-amber-200/20 bg-amber-200/10 p-8 text-amber-100">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-200">Pages unavailable</p>
            <h2 className="mt-3 text-3xl font-black text-white">Chapter ini belum punya pages.</h2>
            <p className="mt-3 text-sm leading-6 text-amber-100/85">
              Metadata chapter sudah masuk dari source, tapi fetch pages belum berhasil. Coba retry import dari Admin atau buka chapter lain.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={`/series/${series.slug}`} className="rounded-full bg-lime-300 px-5 py-3 font-black text-black hover:bg-lime-200">
                Back to detail
              </Link>
              <Link href="/admin" className="rounded-full border border-white/15 px-5 py-3 font-black text-white hover:bg-white/10">
                Open admin
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
