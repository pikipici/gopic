"use client";

import { useEffect, useState } from "react";
import { ReaderProgressTracker } from "@/components/reader-progress-tracker";
import { getChapterProgress } from "@/lib/reading-progress";
import type { ChapterPage } from "@/lib/types";

type WidthMode = "compact" | "comfort" | "wide";
type GapMode = "tight" | "normal" | "airy";
type BackgroundMode = "black" | "charcoal" | "paper";

type ReaderSettings = {
  width: WidthMode;
  gap: GapMode;
  background: BackgroundMode;
};

const SETTINGS_KEY = "gomic:reader-settings:v1";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

function resolvePageImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("/uploads/") && apiBaseUrl) {
    return `${apiBaseUrl}${imageUrl}`;
  }
  return imageUrl;
}

const defaultSettings: ReaderSettings = {
  width: "comfort",
  gap: "normal",
  background: "black",
};

const widthClass: Record<WidthMode, string> = {
  compact: "max-w-2xl",
  comfort: "max-w-3xl",
  wide: "max-w-5xl",
};

const gapClass: Record<GapMode, string> = {
  tight: "mb-0",
  normal: "mb-2",
  airy: "mb-6",
};

const backgroundClass: Record<BackgroundMode, string> = {
  black: "bg-black",
  charcoal: "bg-[#111116]",
  paper: "bg-[#d8d0bd]",
};

function loadSettings(): ReaderSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return defaultSettings;
  }
}

export function ReaderShell({
  pages,
  seriesSlug,
  chapterSlug,
}: {
  pages: ChapterPage[];
  seriesSlug: string;
  chapterSlug: string;
}) {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const progress = getChapterProgress(seriesSlug, chapterSlug);
    if (!progress || progress.pageNumber <= 1) {
      return;
    }
    document.querySelector(`[data-reader-page="${progress.pageNumber}"]`)?.scrollIntoView({ block: "start" });
  }, [chapterSlug, seriesSlug]);

  const updateSettings = <Key extends keyof ReaderSettings>(key: Key, value: ReaderSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className={`${backgroundClass[settings.background]} min-h-screen pb-24 transition-colors`}>
      <div className="sticky top-[145px] z-20 mx-auto mb-4 max-w-5xl px-3 sm:top-[89px] sm:px-4">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/10 bg-black/75 p-2 text-xs font-bold text-zinc-300 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <ToggleGroup
            label="Width"
            value={settings.width}
            values={["compact", "comfort", "wide"]}
            onChange={(value) => updateSettings("width", value as WidthMode)}
          />
          <ToggleGroup
            label="Gap"
            value={settings.gap}
            values={["tight", "normal", "airy"]}
            onChange={(value) => updateSettings("gap", value as GapMode)}
          />
          <ToggleGroup
            label="BG"
            value={settings.background}
            values={["black", "charcoal", "paper"]}
            onChange={(value) => updateSettings("background", value as BackgroundMode)}
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-0 py-1 sm:px-4">
        <div className="mx-auto mb-4 max-w-3xl rounded-3xl border border-white/10 bg-black/55 p-4 text-center text-sm text-zinc-400">
          Reader settings sekarang persist lokal. Progress page juga otomatis masuk Library.
        </div>
        {pages.map((page) => (
          <section
            key={page.pageNumber}
            data-reader-page={page.pageNumber}
            className={`mx-auto ${widthClass[settings.width]} ${gapClass[settings.gap]} overflow-hidden bg-zinc-950 shadow-2xl shadow-black/40 sm:rounded-[1.75rem]`}
          >
            <img
              src={resolvePageImageUrl(page.imageUrl)}
              alt={`Page ${page.pageNumber}`}
              loading={page.pageNumber <= 2 ? "eager" : "lazy"}
              className="block h-auto w-full border border-white/5 bg-zinc-950"
            />
          </section>
        ))}
      </div>
      <ReaderProgressTracker seriesSlug={seriesSlug} chapterSlug={chapterSlug} totalPages={pages.length} />
    </div>
  );
}

function ToggleGroup({
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
    <div className="flex items-center gap-1 rounded-2xl bg-white/[0.06] p-1">
      <span className="px-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {values.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded-xl px-2.5 py-1.5 transition ${item === value ? "bg-lime-300 text-black" : "hover:bg-white/10 hover:text-white"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
