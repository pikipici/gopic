import { CatalogBrowser } from "@/components/catalog-browser";
import { getAllGenres, getAllSeries } from "@/lib/catalog";

export const metadata = {
  title: "Series — Gomic",
};

export default async function SeriesIndexPage() {
  const seriesList = await getAllSeries();
  const genres = await getAllGenres();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-300">Catalog</p>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Semua series</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Search dan filter jalan di seed data dulu. Nanti shape yang sama tinggal diganti API client Go.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-zinc-400">
          <span className="font-bold text-white">{seriesList.length}</span> titles · <span className="font-bold text-white">{genres.length}</span> genres
        </div>
      </div>
      <CatalogBrowser seriesList={seriesList} genres={genres} />
    </main>
  );
}
