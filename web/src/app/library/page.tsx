import { LibraryProgress } from "@/components/library-progress";
import { getAllSeries } from "@/lib/catalog";

export const metadata = {
  title: "Library — Gomic",
};

export default async function LibraryPage() {
  const seriesList = await getAllSeries();
  const readableCount = seriesList.filter((series) => series.latestChapter && series.latestChapter.pageCount > 0).length;
  const partialCount = seriesList.filter((series) => series.latestChapter && series.latestChapter.pageCount === 0).length;

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_20%_20%,rgba(190,242,100,0.15),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(56,189,248,0.12),transparent_26%)]" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-8 shadow-2xl shadow-black/25 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-300">Local library</p>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">Reading progress</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Progress baca disimpan di localStorage browser ini. Daftar series tetap dari API/imported catalog, jadi chapter KomikCast dan KomikIndo langsung bisa lanjut dibaca.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Catalog" value={seriesList.length.toString()} />
            <Stat label="Readable" value={readableCount.toString()} />
            <Stat label="Partial" value={partialCount.toString()} />
          </div>
        </section>
        <LibraryProgress seriesList={seriesList} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
