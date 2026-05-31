"use client";

import { useEffect, useState } from "react";
import { upsertReadingProgress } from "@/lib/reading-progress";

type ReaderProgressTrackerProps = {
  seriesSlug: string;
  chapterSlug: string;
  totalPages: number;
};

export function ReaderProgressTracker({ seriesSlug, chapterSlug, totalPages }: ReaderProgressTrackerProps) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const pageNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reader-page]"));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const page = Number(visible.target.getAttribute("data-reader-page"));
        if (!Number.isNaN(page)) {
          setCurrentPage(page);
          upsertReadingProgress({ seriesSlug, chapterSlug, pageNumber: page, totalPages });
        }
      },
      { threshold: [0.35, 0.6, 0.85] },
    );

    pageNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [chapterSlug, seriesSlug, totalPages]);

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
        <span>Page {currentPage}</span>
        <span>{totalPages} total</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-lime-300 transition-all duration-300"
          style={{ width: `${Math.max(8, (currentPage / totalPages) * 100)}%` }}
        />
      </div>
    </div>
  );
}
