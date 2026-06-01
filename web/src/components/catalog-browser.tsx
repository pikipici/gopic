"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { SeriesCard } from "@/components/series-card";
import type { ContentRating, Demographic, SeriesStatus, SeriesSummary, SeriesType } from "@/lib/types";
import { titleCase } from "@/lib/format";

type SortMode = "latest" | "title" | "chapters" | "year";

const ALL = "All";
const filterKeys = ["q", "genre", "type", "status", "demographic", "rating", "sort"];

function facetLabel(value: string) {
  return titleCase(value);
}

export function CatalogBrowser({ seriesList, genres }: { seriesList: SeriesSummary[]; genres: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQueryState] = useState(searchParams.get("q") ?? "");
  const genre = searchParams.get("genre") ?? ALL;
  const status = (searchParams.get("status") ?? ALL) as typeof ALL | SeriesStatus;
  const type = (searchParams.get("type") ?? ALL) as typeof ALL | SeriesType;
  const demographic = (searchParams.get("demographic") ?? ALL) as typeof ALL | Demographic;
  const rating = (searchParams.get("rating") ?? ALL) as typeof ALL | ContentRating;
  const sort = (searchParams.get("sort") ?? "latest") as SortMode;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL || (key === "sort" && value === "latest")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  const setQuery = (value: string) => {
    setQueryState(value);
    updateParam("q", value.trim());
  };

  const facets = useMemo(
    () => ({
      types: Array.from(new Set(seriesList.map((series) => series.type))).sort(),
      statuses: Array.from(new Set(seriesList.map((series) => series.status))).sort(),
      demographics: Array.from(new Set(seriesList.map((series) => series.demographic))).sort(),
      ratings: Array.from(new Set(seriesList.map((series) => series.contentRating))).sort(),
    }),
    [seriesList],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return seriesList
      .filter((series) => {
        const matchesQuery =
          !needle ||
          [series.title, series.synopsis, series.authorName, series.artistName, ...series.altTitles]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        const matchesGenre = genre === ALL || series.genres.includes(genre);
        const matchesStatus = status === ALL || series.status === status;
        const matchesType = type === ALL || series.type === type;
        const matchesDemographic = demographic === ALL || series.demographic === demographic;
        const matchesRating = rating === ALL || series.contentRating === rating;

        return matchesQuery && matchesGenre && matchesStatus && matchesType && matchesDemographic && matchesRating;
      })
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "chapters") return b.chapterCount - a.chapterCount;
        if (sort === "year") return b.releaseYear - a.releaseYear;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [demographic, genre, query, rating, seriesList, sort, status, type]);

  const resetFilters = () => {
    setQueryState("");
    const next = new URLSearchParams(searchParams.toString());
    filterKeys.forEach((key) => next.delete(key));
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  const readableCount = filtered.filter((series) => series.latestChapter && series.latestChapter.pageCount > 0).length;
  const partialCount = filtered.filter((series) => series.latestChapter && series.latestChapter.pageCount === 0).length;

  return (
    <section>
      <div className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.13),transparent_34%),rgba(255,255,255,0.045)] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 px-4 py-4 sm:flex sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">Browse controls</p>
            <h2 className="mt-1 text-2xl font-black text-white">Find imported titles faster</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-zinc-300 sm:mt-0">
            <span className="rounded-full bg-lime-300 px-3 py-1 text-black">{readableCount} readable</span>
            <span className="rounded-full bg-amber-300/15 px-3 py-1 text-amber-100">{partialCount} partial</span>
            <span className="rounded-full bg-white/10 px-3 py-1">{filtered.length}/{seriesList.length} shown</span>
          </div>
        </div>
        <div className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(2,180px)]">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari judul, author, alt title..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-lime-300/60"
              />
            </label>
            <FacetSelect label="Genre" value={genre} onChange={(value) => updateParam("genre", value)} values={genres} />
            <FacetSelect label="Type" value={type} onChange={(value) => updateParam("type", value)} values={facets.types} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[repeat(4,180px)_1fr]">
            <FacetSelect label="Status" value={status} onChange={(value) => updateParam("status", value)} values={facets.statuses} />
            <FacetSelect label="Demographic" value={demographic} onChange={(value) => updateParam("demographic", value)} values={facets.demographics} />
            <FacetSelect label="Rating" value={rating} onChange={(value) => updateParam("rating", value)} values={facets.ratings} />
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Sort</span>
              <select
                value={sort}
                onChange={(event) => updateParam("sort", event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none transition focus:border-lime-300/60"
              >
                <option value="latest">Latest update</option>
                <option value="title">Title A-Z</option>
                <option value="chapters">Most chapters</option>
                <option value="year">Newest year</option>
              </select>
            </label>
            <div className="flex items-end lg:justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="h-12 w-full rounded-2xl border border-white/10 px-5 text-sm font-black text-zinc-300 transition hover:bg-white/10 hover:text-white lg:w-auto"
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((series) => (
            <SeriesCard key={series.slug} series={series} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Filter terlalu sempit"
          description="Belum ada series yang cocok. Coba reset filter atau longgarkan search supaya imported catalog muncul lagi."
        />
      )}
    </section>
  );
}

function FacetSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none transition focus:border-lime-300/60"
      >
        <option>{ALL}</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {facetLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
