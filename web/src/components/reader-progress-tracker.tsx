"use client";

import { useEffect } from "react";
import { upsertReadingProgress } from "@/lib/reading-progress";

type ReaderProgressTrackerProps = {
  seriesSlug: string;
  chapterSlug: string;
  totalPages: number;
};

export function ReaderProgressTracker({ seriesSlug, chapterSlug, totalPages }: ReaderProgressTrackerProps) {
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
          upsertReadingProgress({ seriesSlug, chapterSlug, pageNumber: page, totalPages });
        }
      },
      { threshold: [0.35, 0.6, 0.85] },
    );

    pageNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [chapterSlug, seriesSlug, totalPages]);

  return null;
}
