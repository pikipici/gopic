"use client";

import { type ReactNode, useEffect, useState } from "react";
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

type ReaderPageImageProps = {
  page: ChapterPage;
};

function ReaderPageImage({ page }: ReaderPageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const resolvedUrl = resolvePageImageUrl(page.imageUrl);

  if (!page.imageUrl) {
    return <PageFallback pageNumber={page.pageNumber} message="Image URL kosong dari source." />;
  }

  if (failed) {
    return (
      <PageFallback pageNumber={page.pageNumber} message="Gagal load image page ini." imageUrl={resolvedUrl}>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setLoaded(false);
            setRetryKey((value) => value + 1);
          }}
          className="rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-black transition hover:bg-lime-200"
        >
          Retry page
        </button>
      </PageFallback>
    );
  }

  return (
    <div className="relative min-h-80 bg-zinc-950">
      {!loaded ? (
        <div className="absolute inset-0 grid min-h-80 place-items-center border border-white/5 bg-[radial-gradient(circle_at_center,rgba(190,242,100,0.12),transparent_45%)] text-sm font-bold text-zinc-400">
          Loading page {page.pageNumber}...
        </div>
      ) : null}
      <img
        key={retryKey}
        src={resolvedUrl}
        alt={`Page ${page.pageNumber}`}
        loading={page.pageNumber <= 2 ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`block h-auto w-full border border-white/5 bg-zinc-950 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function PageFallback({
  pageNumber,
  message,
  imageUrl,
  children,
}: {
  pageNumber: number;
  message: string;
  imageUrl?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-80 place-items-center border border-amber-200/20 bg-amber-200/10 p-6 text-center text-amber-100">
      <div className="max-w-xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-200">Page {pageNumber}</p>
        <h3 className="mt-3 text-2xl font-black text-white">Image unavailable</h3>
        <p className="mt-2 text-sm text-amber-100/85">{message}</p>
        {imageUrl ? <p className="mt-3 break-all text-xs text-amber-100/60">{imageUrl}</p> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </div>
  );
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
      <div className="sticky top-[145px] z-20 mx-auto mb-4 max-w-6xl px-3 sm:top-[89px] sm:px-4">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/80 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">Reader</span>
              <span className="text-xs font-bold text-zinc-400">{pages.length} pages</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-zinc-300 lg:justify-end">
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
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-0 py-1 sm:px-4">
        <div className="mx-auto mb-4 max-w-3xl rounded-3xl border border-white/10 bg-black/55 p-4 text-center text-sm text-zinc-400 shadow-xl shadow-black/20">
          Reader settings persist lokal. Progress page otomatis masuk Library.
        </div>
        {pages.map((page) => (
          <section
            key={page.pageNumber}
            data-reader-page={page.pageNumber}
            className={`group relative mx-auto ${widthClass[settings.width]} ${gapClass[settings.gap]} overflow-hidden bg-zinc-950 shadow-2xl shadow-black/40 sm:rounded-[1.75rem]`}
          >
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              Page {page.pageNumber}/{pages.length}
            </div>
            <ReaderPageImage page={page} />
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
      <span className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</span>
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
