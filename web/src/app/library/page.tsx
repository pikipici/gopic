import { LibraryProgress } from "@/components/library-progress";
import { getAllSeries } from "@/lib/catalog";

export const metadata = {
  title: "Library — Gomic",
};

export default async function LibraryPage() {
  const seriesList = await getAllSeries();
  const readableCount = seriesList.filter((series) => series.latestChapter && series.latestChapter.pageCount > 0).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">Local library</p>
        <h1 className="mt-4 text-4xl font-black text-white">Reading progress</h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Progress baca tetap disimpan di localStorage browser, tapi daftar series sekarang memakai katalog API/imported source.
          Ada {readableCount} dari {seriesList.length} series yang punya chapter siap dibaca.
        </p>
      </section>
      <LibraryProgress seriesList={seriesList} />
    </main>
  );
}
