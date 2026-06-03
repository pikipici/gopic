"use client";

import Link from "next/link";
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { ReaderProgressTracker } from "@/components/reader-progress-tracker";
import { getChapterProgress } from "@/lib/reading-progress";
import type { ChapterPage } from "@/lib/types";

const SETTINGS_KEY = "gomic:reader-settings:v2";
const FOCUS_TIP_KEY = "gomic:reader-focus-tip-seen:v1";
const HORIZONTAL_TIP_KEY = "gomic:reader-horizontal-tip-seen:v1";
const FOLLOWED_SERIES_KEY = "gomic:followed-series:v1";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

type ReadingDirection = "Left to right" | "Right to left" | "Top to bottom";
type ProgressPosition = "left" | "top" | "bottom" | "right" | "none";
type PreloadMode = "some" | "all";
type PageLayout = "single" | "double" | "long-strip";

type ReaderSettings = {
  direction: ReadingDirection;
  stripMargin: number;
  progressPosition: ProgressPosition;
  preloadMode: PreloadMode;
  pageLayout: PageLayout;
  greyscale: boolean;
  dimPages: boolean;
};

type ReaderChapterLink = {
  slug: string;
  label: string;
  title: string;
  href: string;
};

const defaultReaderSettings: ReaderSettings = {
  direction: "Top to bottom",
  stripMargin: 0,
  progressPosition: "none",
  preloadMode: "some",
  pageLayout: "long-strip",
  greyscale: false,
  dimPages: false,
};

function resolvePageImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("/uploads/") && apiBaseUrl) {
    return `${apiBaseUrl}${imageUrl}`;
  }
  return imageUrl;
}

function loadZoom() {
  if (typeof window === "undefined") {
    return 100;
  }

  const storedValue = window.localStorage.getItem(SETTINGS_KEY);
  if (!storedValue) {
    return 100;
  }

  if (storedValue.startsWith("{")) {
    try {
      const value = Number((JSON.parse(storedValue) as { zoom?: unknown }).zoom);
      return Number.isFinite(value) ? Math.min(Math.max(value, 50), 160) : 100;
    } catch {
      return 100;
    }
  }

  const value = Number(storedValue);
  return Number.isFinite(value) ? Math.min(Math.max(value, 50), 160) : 100;
}

function isReadingDirection(value: unknown): value is ReadingDirection {
  return value === "Left to right" || value === "Right to left" || value === "Top to bottom";
}

function isProgressPosition(value: unknown): value is ProgressPosition {
  return value === "left" || value === "top" || value === "bottom" || value === "right" || value === "none";
}

function isPreloadMode(value: unknown): value is PreloadMode {
  return value === "some" || value === "all";
}

function isPageLayout(value: unknown): value is PageLayout {
  return value === "single" || value === "double" || value === "long-strip";
}

function loadReaderSettings() {
  if (typeof window === "undefined") {
    return defaultReaderSettings;
  }

  try {
    const storedValue = window.localStorage.getItem(SETTINGS_KEY);
    if (!storedValue?.startsWith("{")) {
      return defaultReaderSettings;
    }

    const parsed = JSON.parse(storedValue) as { settings?: Partial<ReaderSettings> };
    const storedSettings = parsed.settings ?? {};
    return {
      direction: isReadingDirection(storedSettings.direction) ? storedSettings.direction : defaultReaderSettings.direction,
      stripMargin: Number.isFinite(storedSettings.stripMargin) ? Math.min(Math.max(Number(storedSettings.stripMargin), 0), 8) : defaultReaderSettings.stripMargin,
      progressPosition: isProgressPosition(storedSettings.progressPosition) ? storedSettings.progressPosition : defaultReaderSettings.progressPosition,
      preloadMode: isPreloadMode(storedSettings.preloadMode) ? storedSettings.preloadMode : defaultReaderSettings.preloadMode,
      pageLayout: isPageLayout(storedSettings.pageLayout) ? storedSettings.pageLayout : defaultReaderSettings.pageLayout,
      greyscale: Boolean(storedSettings.greyscale),
      dimPages: Boolean(storedSettings.dimPages),
    };
  } catch {
    return defaultReaderSettings;
  }
}

function loadOneTimeHint(key: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(key) !== "1";
}

function loadFollowedSeries(seriesSlug: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const followed = JSON.parse(window.localStorage.getItem(FOLLOWED_SERIES_KEY) ?? "[]") as unknown;
    return Array.isArray(followed) && followed.includes(seriesSlug);
  } catch {
    return false;
  }
}

type ReaderPageImageProps = {
  page: ChapterPage;
  zoom: number;
  settings: ReaderSettings;
};

function ReaderPageImage({ page, zoom, settings }: ReaderPageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const resolvedUrl = resolvePageImageUrl(page.imageUrl);
  const maxWidth = Math.round(800 * (zoom / 100));

  if (!page.imageUrl) {
    return <PageFallback pageNumber={page.pageNumber} message="Image URL halaman ini kosong." />;
  }

  if (failed) {
    return (
      <PageFallback pageNumber={page.pageNumber} message="Gagal load image page ini." imageUrl={resolvedUrl}>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setRetryKey((value) => value + 1);
            }}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-600"
          >
            Retry page
          </button>
          <a href={resolvedUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-700">
            Open image
          </a>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(resolvedUrl);
              setCopied(true);
            }}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-700"
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
        </div>
      </PageFallback>
    );
  }

  return (
    <div className="relative w-full bg-[#0f0f0f]" style={{ maxWidth }}>
      {!loaded ? (
        <div className="absolute inset-0 grid min-h-80 place-items-center bg-zinc-900 text-sm font-medium text-zinc-400 animate-pulse">
          Loading page {page.pageNumber}...
        </div>
      ) : null}
      {/* Reader pages may be cached locally or served from arbitrary source hosts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={retryKey}
        src={resolvedUrl}
        alt={`Page ${page.pageNumber}`}
        loading={settings.preloadMode === "all" || page.pageNumber <= 2 ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`manga-page block h-auto w-full bg-zinc-950 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ filter: `${settings.greyscale ? "grayscale(1)" : ""} ${settings.dimPages ? "brightness(0.72)" : ""}`.trim() || undefined, imageRendering: "auto" }}
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
    <div className="grid min-h-80 w-full max-w-[800px] place-items-center border border-amber-200/20 bg-amber-200/10 p-6 text-center text-amber-100">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Page {pageNumber}</p>
        <h3 className="mt-3 text-2xl font-bold text-zinc-100">Image unavailable</h3>
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
  seriesTitle,
  chapterSlug,
  chapterTitle,
  chapterLabel,
  chapterLinks,
  detailHref,
  sourceLabel,
  sourceHref,
  previousHref,
  previousLabel,
  nextHref,
  nextLabel,
}: {
  pages: ChapterPage[];
  seriesSlug: string;
  seriesTitle: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterLabel: string;
  chapterLinks: ReaderChapterLink[];
  detailHref: string;
  sourceLabel?: string;
  sourceHref?: string;
  previousHref?: string;
  previousLabel?: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  const [zoom, setZoom] = useState(loadZoom);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showFocusTip, setShowFocusTip] = useState(() => loadOneTimeHint(FOCUS_TIP_KEY));
  const [showHorizontalTip, setShowHorizontalTip] = useState(() => loadOneTimeHint(HORIZONTAL_TIP_KEY));
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings);
  const [progressPercent, setProgressPercent] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const lastTapAtRef = useRef(0);
  const pageRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ zoom, settings }));
  }, [settings, zoom]);

  useEffect(() => {
    const progress = getChapterProgress(seriesSlug, chapterSlug);
    if (!progress || progress.pageNumber <= 1) {
      return;
    }
    document.querySelector(`[data-reader-page="${progress.pageNumber}"]`)?.scrollIntoView({ block: "start" });
  }, [chapterSlug, seriesSlug]);

  useEffect(() => {
    const pageNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reader-page]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const pageNumber = Number(visible?.target.getAttribute("data-reader-page"));
        if (Number.isFinite(pageNumber)) {
          setActivePage(pageNumber);
        }
      },
      { threshold: [0.35, 0.65, 0.9] },
    );

    pageNodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pages, settings.direction]);

  useEffect(() => {
    if (settings.preloadMode !== "all") {
      return;
    }

    const orderedPages = [...pages].sort((a, b) => Math.abs(a.pageNumber - activePage) - Math.abs(b.pageNumber - activePage));
    const preloadedImages: HTMLImageElement[] = [];
    const timeouts = orderedPages.map((page, index) =>
      window.setTimeout(() => {
        if (!page.imageUrl) {
          return;
        }

        const image = new window.Image();
        image.decoding = "async";
        image.src = resolvePageImageUrl(page.imageUrl);
        preloadedImages.push(image);
      }, index * 60),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      preloadedImages.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [activePage, pages, settings.preloadMode]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      if (settings.direction !== "Top to bottom") {
        return;
      }

      const delta = window.scrollY - lastScrollY;
      if (delta > 50) {
        setUiHidden(true);
      } else if (delta < -20) {
        setUiHidden(false);
      }
      lastScrollY = window.scrollY;

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgressPercent(scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [settings.direction]);

  useEffect(() => {
    if (settings.direction === "Top to bottom") {
      return;
    }

    const rail = pageRailRef.current;
    if (!rail) {
      return;
    }

    const updateHorizontalProgress = () => {
      const scrollable = rail.scrollWidth - rail.clientWidth;
      const rawPercent = scrollable > 0 ? Math.abs(rail.scrollLeft / scrollable) * 100 : 0;
      setProgressPercent(Math.min(100, Math.max(0, rawPercent)));
    };

    updateHorizontalProgress();
    rail.addEventListener("scroll", updateHorizontalProgress, { passive: true });
    return () => rail.removeEventListener("scroll", updateHorizontalProgress);
  }, [settings.direction]);

  const toggleFocusMode = () => {
    setFocusMode((value) => !value);
    setSettingsOpen(false);
    setLayoutPanelOpen(false);
    setShowFocusTip(false);
  };

  const isInPageCenter = (clientX: number, clientY: number) => {
    const pageNode = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-reader-page]");
    if (!pageNode) {
      return false;
    }

    const rect = pageNode.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    const relativeY = (clientY - rect.top) / rect.height;
    return relativeX >= 0.25 && relativeX <= 0.75 && relativeY >= 0.2 && relativeY <= 0.8;
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isInPageCenter(event.clientX, event.clientY)) {
      return;
    }

    toggleFocusMode();
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      return;
    }

    const now = window.performance.now();
    if (now - lastTapAtRef.current < 350) {
      if (!isInPageCenter(event.clientX, event.clientY)) {
        lastTapAtRef.current = now;
        return;
      }

      event.preventDefault();
      lastTapAtRef.current = 0;
      toggleFocusMode();
      return;
    }

    lastTapAtRef.current = now;
  };

  const scrollReaderByScreen = useCallback((forward: boolean) => {
    if (settings.direction === "Top to bottom") {
      window.scrollBy({ top: window.innerHeight * (forward ? 0.86 : -0.86), behavior: "smooth" });
      return;
    }

    const rail = pageRailRef.current;
    if (!rail) {
      return;
    }

    const directionMultiplier = settings.direction === "Right to left" ? -1 : 1;
    rail.scrollBy({ left: rail.clientWidth * 0.9 * directionMultiplier * (forward ? 1 : -1), behavior: "smooth" });
  }, [settings.direction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (key === "s" || key === "k") {
        event.preventDefault();
        scrollReaderByScreen(true);
        return;
      }

      if (key === "w" || key === "i") {
        event.preventDefault();
        scrollReaderByScreen(false);
        return;
      }

      if (key === "n" && nextHref) {
        event.preventDefault();
        window.location.href = nextHref;
        return;
      }

      if (key === "b" && previousHref) {
        event.preventDefault();
        window.location.href = previousHref;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextHref, previousHref, scrollReaderByScreen]);

  useEffect(() => {
    if (!showFocusTip) {
      return;
    }

    window.localStorage.setItem(FOCUS_TIP_KEY, "1");
    const timeout = window.setTimeout(() => setShowFocusTip(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [showFocusTip]);

  useEffect(() => {
    if (!showHorizontalTip || settings.direction === "Top to bottom") {
      return;
    }

    window.localStorage.setItem(HORIZONTAL_TIP_KEY, "1");
    const timeout = window.setTimeout(() => setShowHorizontalTip(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [settings.direction, showHorizontalTip]);

  const zoomOut = () => setZoom((value) => Math.max(50, value - 10));
  const zoomIn = () => setZoom((value) => Math.min(160, value + 10));
  const resetZoom = () => setZoom(100);
  const resetReaderSettings = () => {
    setZoom(100);
    setSettings(defaultReaderSettings);
  };

  const isHorizontalReader = settings.direction !== "Top to bottom";
  const horizontalPageWidth = settings.pageLayout === "double" ? "min-w-full snap-center sm:min-w-[50%] sm:snap-start" : "min-w-full snap-center";
  const verticalRailClass = !isHorizontalReader && settings.pageLayout === "double" ? "grid gap-0 sm:grid-cols-2" : "";
  const verticalPageClass = !isHorizontalReader && settings.pageLayout === "single" ? "min-h-screen items-center" : "";
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      return;
    }
    await document.exitFullscreen?.();
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      <header className={`fixed inset-x-0 top-0 z-50 h-12 border-b border-zinc-700 bg-zinc-900/90 backdrop-blur transition-transform duration-200 ${uiHidden || focusMode ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-2 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <ReaderIconLink href="/" label="Home">⌂</ReaderIconLink>
            <ReaderIconLink href={detailHref} label="Back to series">‹</ReaderIconLink>
            <Link href={detailHref} className="min-w-0 truncate px-1.5 text-sm font-medium text-zinc-200 hover:text-cyan-300 sm:px-2 md:max-w-[500px]">
              {seriesTitle}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-zinc-400 sm:inline">{chapterLabel}</span>
            <button type="button" onClick={() => { setSettingsOpen(false); setLayoutPanelOpen((value) => !value); }} className={`grid size-9 place-items-center rounded-lg transition ${layoutPanelOpen ? "border border-cyan-300/60 bg-cyan-400/15 text-cyan-300" : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"}`} aria-label="Layout toggle">⊞</button>
          </div>
        </div>
      </header>

      {showFocusTip ? (
        <div className={`fixed left-1/2 top-16 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-cyan-400/30 bg-zinc-900/90 px-4 py-3 text-center text-sm text-zinc-300 shadow-2xl shadow-black/40 backdrop-blur transition-opacity ${focusMode ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          Press <span className="font-bold text-cyan-300">H</span> or double click the manga to focus reading.
        </div>
      ) : null}

      <main className="flex min-h-screen flex-col items-center bg-[#0f0f0f] pb-28 pt-12">
        <ReaderProgressBar position={settings.progressPosition} percent={progressPercent} hidden={focusMode || settings.progressPosition === "none"} />
        {!focusMode ? <ReaderPageIndicator activePage={activePage} totalPages={pages.length} hidden={uiHidden || settings.progressPosition === "none"} /> : null}
        {showHorizontalTip && !focusMode && isHorizontalReader ? <ReaderHint text="Swipe horizontally or press S/K to continue." /> : null}
        <div ref={pageRailRef} className={`w-full min-w-0 touch-manipulation ${settings.direction === "Right to left" ? "flex snap-x snap-mandatory flex-row-reverse overflow-x-auto scroll-smooth" : settings.direction === "Left to right" ? "flex snap-x snap-mandatory overflow-x-auto scroll-smooth" : verticalRailClass}`} onDoubleClick={handleCanvasDoubleClick} onPointerDown={handleCanvasPointerDown}>
          {pages.map((page) => (
            <section key={page.pageNumber} data-reader-page={page.pageNumber} className={`mx-auto flex w-full justify-center bg-[#0f0f0f] ${isHorizontalReader ? horizontalPageWidth : verticalPageClass}`} style={{ paddingBlock: isHorizontalReader ? 0 : settings.stripMargin * 4, paddingInline: isHorizontalReader ? settings.stripMargin * 4 : 0 }}>
              <ReaderPageImage page={page} zoom={zoom} settings={settings} />
            </section>
          ))}
          <section className={`mx-auto w-full px-4 ${isHorizontalReader ? "grid min-w-full snap-center place-items-center" : "mt-8 max-w-[800px]"}`}>
          <div className="w-full max-w-[800px] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center shadow-2xl shadow-black/40">
            <p className="text-base font-semibold text-zinc-100">End of {chapterLabel}</p>
            {chapterTitle ? <p className="mt-1 text-sm text-zinc-400">{chapterTitle}</p> : null}
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <ReaderNavLink href={previousHref} label={previousLabel ? `‹ Previous ${previousLabel}` : "‹ Previous Chapter"} />
              <Link href={detailHref} className="rounded-lg border border-zinc-600 bg-zinc-800 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700">
                Back to title
              </Link>
              <ReaderNavLink href={nextHref} label={nextLabel ? `Next ${nextLabel} ›` : "Next Chapter ›"} primary />
            </div>
          </div>
          </section>
        </div>
      </main>

      {settingsOpen && !focusMode ? <ReaderSettingsModal zoom={zoom} setZoom={setZoom} settings={settings} setSettings={setSettings} resetSettings={resetReaderSettings} onClose={() => setSettingsOpen(false)} /> : null}
      {layoutPanelOpen && !focusMode ? <ReaderLayoutPanel seriesSlug={seriesSlug} chapterSlug={chapterSlug} chapterTitle={chapterTitle} chapterLinks={chapterLinks} seriesTitle={seriesTitle} sourceLabel={sourceLabel} sourceHref={sourceHref} onClose={() => setLayoutPanelOpen(false)} /> : null}

      <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-transform duration-200 ${uiHidden || focusMode ? "translate-y-32" : "translate-y-0"}`}>
        <div className="flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-1 rounded-xl border border-zinc-600 bg-zinc-800/95 px-2 py-2 shadow-2xl shadow-black/50 backdrop-blur sm:flex-nowrap sm:px-3">
          <ReaderToolbarButton onClick={() => (previousHref ? (window.location.href = previousHref) : undefined)} disabled={!previousHref} label="Previous">←</ReaderToolbarButton>
          <div className="mx-1 h-5 w-px bg-zinc-700" />
          <ReaderToolbarButton onClick={zoomOut} label="Zoom out">−</ReaderToolbarButton>
          <button type="button" onClick={resetZoom} className="min-w-12 rounded-lg px-2 py-2 text-center text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100">{zoom}%</button>
          <ReaderToolbarButton onClick={zoomIn} label="Zoom in">+</ReaderToolbarButton>
          <ReaderToolbarButton onClick={toggleFullscreen} label="Fullscreen">⛶</ReaderToolbarButton>
          <ReaderToolbarButton onClick={() => { setLayoutPanelOpen(false); setSettingsOpen((value) => !value); }} label="Settings">⚙</ReaderToolbarButton>
        </div>
      </div>

      <ReaderProgressTracker seriesSlug={seriesSlug} chapterSlug={chapterSlug} totalPages={pages.length} />
    </div>
  );
}

function ReaderIconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} className="grid size-8 shrink-0 place-items-center rounded-lg text-xl text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 sm:size-9">
      {children}
    </Link>
  );
}

function ReaderToolbarButton({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="grid size-9 shrink-0 place-items-center rounded-lg text-lg text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35">
      {children}
    </button>
  );
}

type SettingsTab = "layout" | "image" | "shortcuts";

function ReaderProgressBar({ position, percent, hidden }: { position: ProgressPosition; percent: number; hidden: boolean }) {
  if (hidden) {
    return null;
  }

  const isHorizontal = position === "top" || position === "bottom";
  const placement = {
    top: "inset-x-0 top-0 h-1",
    bottom: "inset-x-0 bottom-0 h-1",
    left: "inset-y-0 left-0 w-1",
    right: "inset-y-0 right-0 w-1",
    none: "",
  }[position];

  return (
    <div className={`fixed z-40 bg-zinc-900/70 ${placement}`} aria-hidden>
      <div className="bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.55)] transition-all duration-150" style={isHorizontal ? { height: "100%", width: `${percent}%` } : { height: `${percent}%`, width: "100%" }} />
    </div>
  );
}

function ReaderPageIndicator({ activePage, totalPages, hidden }: { activePage: number; totalPages: number; hidden: boolean }) {
  return (
    <div className={`pointer-events-none fixed right-4 top-16 z-40 rounded-full border border-zinc-700 bg-zinc-900/75 px-3 py-1 text-xs font-medium text-zinc-400 shadow-xl shadow-black/30 backdrop-blur transition-opacity duration-200 ${hidden ? "opacity-0" : "opacity-100"}`}>
      {activePage}/{totalPages}
    </div>
  );
}

function ReaderHint({ text }: { text: string }) {
  return <div className="pointer-events-none fixed left-1/2 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-full border border-cyan-400/20 bg-zinc-900/80 px-3 py-1.5 text-center text-xs font-medium text-zinc-400 shadow-xl shadow-black/30 backdrop-blur">{text}</div>;
}

function ReaderLayoutPanel({
  seriesSlug,
  chapterSlug,
  chapterTitle,
  chapterLinks,
  seriesTitle,
  sourceLabel,
  sourceHref,
  onClose,
}: {
  seriesSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterLinks: ReaderChapterLink[];
  seriesTitle: string;
  sourceLabel?: string;
  sourceHref?: string;
  onClose: () => void;
}) {
  const [followed, setFollowed] = useState(() => loadFollowedSeries(seriesSlug));
  const [commentSort, setCommentSort] = useState<"Best" | "Newest" | "Oldest">("Best");
  const toggleFollow = () => {
    setFollowed((value) => {
      const stored = JSON.parse(window.localStorage.getItem(FOLLOWED_SERIES_KEY) ?? "[]") as unknown;
      const followedSeries = Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
      const nextFollowed = value ? followedSeries.filter((item) => item !== seriesSlug) : [...new Set([...followedSeries, seriesSlug])];
      window.localStorage.setItem(FOLLOWED_SERIES_KEY, JSON.stringify(nextFollowed));
      return !value;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/35" onClick={onClose}>
      <aside className="fixed right-0 top-0 flex h-dvh w-full max-w-[min(480px,100vw)] flex-col border-l border-[#3f464d] bg-[#242a30] text-[#d1d5db] shadow-2xl shadow-black/60 transition duration-200 animate-in slide-in-from-right lg:w-[28vw] lg:min-w-[440px]" onClick={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 border-b border-[#3f464d] bg-[#242a30]/95 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center">
            <select value={chapterSlug} onChange={(event) => { window.location.href = chapterLinks.find((chapter) => chapter.slug === event.target.value)?.href ?? window.location.href; }} className="min-w-0 rounded-lg border border-[#42484f] bg-[#3a4047] px-2.5 py-2 text-sm font-medium text-zinc-300 outline-none transition hover:border-cyan-300/60 focus:border-cyan-300 sm:flex-[1.15]">
              {chapterLinks.map((chapter) => (
                <option key={chapter.slug} value={chapter.slug}>{chapter.label}{chapter.title ? ` - ${chapter.title}` : ""}</option>
              ))}
            </select>
            <span className="hidden size-9 shrink-0 place-items-center rounded-lg border border-[#42484f] bg-[#3a4047] text-sm text-zinc-500 sm:grid" title="Chapter status">⌕</span>
            {sourceHref ? (
              <a href={sourceHref} target="_blank" rel="noreferrer" className="col-span-2 min-w-0 truncate rounded-lg border border-[#42484f] bg-[#3a4047] px-2.5 py-2 text-sm text-zinc-400 transition hover:border-cyan-300/60 hover:text-cyan-300 sm:col-span-1 sm:flex-1">
                {sourceLabel ?? "Source"}
              </a>
            ) : (
              <div className="col-span-2 min-w-0 truncate rounded-lg border border-[#42484f] bg-[#3a4047] px-2.5 py-2 text-sm text-zinc-500 sm:col-span-1 sm:flex-1">
                {sourceLabel ?? "Local source"}
              </div>
            )}
            <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-[#3a4047] hover:text-zinc-100" aria-label="Close layout panel">
              X
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <section className="rounded-xl border border-[#3f464d] bg-[#2b3036] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-zinc-300">{seriesTitle}</h3>
                <p className="mt-1 text-xs text-zinc-500">♡ 128 likes · Translated by {sourceLabel ?? "Local team"}</p>
                {chapterTitle ? <p className="mt-1 truncate text-sm text-zinc-500">{chapterTitle}</p> : null}
              </div>
              <button type="button" onClick={toggleFollow} className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition ${followed ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/20" : "border-[#42484f] bg-[#3a4047] text-zinc-300 hover:border-cyan-300/50 hover:text-cyan-300"}`}>
                {followed ? "Following" : "Follow"}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <p className="rounded-xl border border-[#3f464d] bg-[#2b3036] p-3 text-xs leading-5 text-zinc-500">
              Keep comments respectful. Spoilers and source links may be removed by moderators.
            </p>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-zinc-300">21 comments</h3>
              <div className="flex rounded-lg border border-[#42484f] bg-[#3a4047] p-1">
                {(["Best", "Newest", "Oldest"] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setCommentSort(item)} className={`rounded-md px-2 py-1 text-xs font-medium transition ${commentSort === item ? "bg-cyan-400/15 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <textarea rows={3} placeholder="Write a comment..." className="w-full resize-none rounded-xl border border-[#42484f] bg-[#3a4047] px-3 py-2 text-sm text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-300" />
            <div className="space-y-2">
              <PanelComment author="Mika" text="Clean chapter. The vertical layout reads best for this one." />
              <PanelComment author="Raka" text="Double page mode feels nice on desktop." />
              <PanelComment author="Nina" text="Thanks for the update." />
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function PanelComment({ author, text }: { author: string; text: string }) {
  return (
    <article className="rounded-xl border border-[#3f464d] bg-[#2b3036] p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-[#3a4047] text-xs font-semibold text-cyan-300">{author.slice(0, 1)}</span>
        <span className="text-sm font-medium text-zinc-300">{author}</span>
        <span className="text-xs text-zinc-600">now</span>
      </div>
      <p className="mt-2 text-sm leading-5 text-zinc-500">{text}</p>
    </article>
  );
}

function ReaderSettingsModal({
  zoom,
  setZoom,
  settings,
  setSettings,
  resetSettings,
  onClose,
}: {
  zoom: number;
  setZoom: (value: number) => void;
  settings: ReaderSettings;
  setSettings: Dispatch<SetStateAction<ReaderSettings>>;
  resetSettings: () => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("layout");
  const updateSettings = (nextSettings: Partial<ReaderSettings>) => setSettings((value) => ({ ...value, ...nextSettings }));

  return (
    <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <section className="fixed left-1/2 top-[52%] max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-[45%] overflow-hidden rounded-xl border border-[#42484f] bg-[#2f343a] text-[#d1d5db] shadow-2xl shadow-black/60 transition duration-150 animate-in fade-in zoom-in-95" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-2 border-b border-[#42484f] p-2.5">
          <div className="flex min-w-0 gap-1 overflow-x-auto text-sm font-medium">
            {(["layout", "image", "shortcuts"] as SettingsTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-2.5 py-1.5 capitalize transition ${activeTab === tab ? "bg-cyan-400/15 text-cyan-300" : "text-zinc-400 hover:bg-[#3a4047] hover:text-zinc-200"}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={resetSettings} className="rounded-lg px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-[#3a4047] hover:text-cyan-300" aria-label="Reset reader settings">
              Reset
            </button>
            <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-[#3a4047] hover:text-zinc-100" aria-label="Close settings">
              X
            </button>
          </div>
        </header>

        <div className="max-h-[calc(100dvh-7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto px-4 py-4">
          {activeTab === "layout" ? (
            <div className="space-y-4">
              <SettingsSection title="Reading Direction">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {(["Left to right", "Right to left", "Top to bottom"] as ReadingDirection[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => updateSettings({ direction: item })}
                      className={`min-h-[72px] rounded-[10px] border px-3 py-3.5 text-center transition ${settings.direction === item ? "border-cyan-300 bg-cyan-400/15 text-cyan-300" : "border-[#42484f] bg-[#3a4047] text-zinc-300 hover:border-cyan-300/60 hover:text-zinc-100"}`}
                    >
                      <span className="block text-xl">{item === "Top to bottom" ? "↧" : item === "Left to right" ? "↦" : "↤"}</span>
                      <span className="mt-1.5 block text-xs">{item}</span>
                    </button>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection title="Strip Margin">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#42484f] bg-[#3a4047] p-2">
                  <ControlButton onClick={() => updateSettings({ stripMargin: Math.max(0, settings.stripMargin - 1) })}>−</ControlButton>
                  <span className="min-w-14 flex-1 text-center text-sm text-zinc-300">{settings.stripMargin}</span>
                  <ControlButton onClick={() => updateSettings({ stripMargin: Math.min(8, settings.stripMargin + 1) })}>+</ControlButton>
                  <button type="button" onClick={() => updateSettings({ stripMargin: 0 })} disabled={settings.stripMargin === 0} className="rounded-lg border border-[#42484f] bg-[#3a4047] px-3 py-2 text-xs text-zinc-300 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600/40 disabled:text-zinc-500">
                    Reset
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection title="Progress Bar">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "left", icon: "←" },
                    { label: "top", icon: "↑" },
                    { label: "bottom", icon: "↓" },
                    { label: "right", icon: "→" },
                    { label: "none", icon: "×" },
                  ].map((item) => (
                    <button key={item.label} type="button" onClick={() => updateSettings({ progressPosition: item.label as ProgressPosition })} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs capitalize transition ${settings.progressPosition === item.label ? "border-cyan-300 bg-cyan-400/15 text-cyan-300" : "border-[#42484f] bg-[#3a4047] text-zinc-400 hover:text-zinc-200"}`}>
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection title="Zoom">
                <input type="range" min="50" max="160" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-cyan-500" />
                <p className="mt-2 text-center text-sm text-zinc-300">{zoom}%</p>
              </SettingsSection>
            </div>
          ) : null}

          {activeTab === "image" ? (
            <div className="space-y-4">
              <SettingsSection title="Image Loading">
                <div className="grid gap-2">
                  <RadioRow active={settings.preloadMode === "some"} onClick={() => updateSettings({ preloadMode: "some" })} label="Preload some images" />
                  <RadioRow active={settings.preloadMode === "all"} onClick={() => updateSettings({ preloadMode: "all" })} label="Preload all images" />
                </div>
              </SettingsSection>

              <SettingsSection title="Image Coloring">
                <div className="grid gap-2">
                  <CheckboxRow checked={settings.greyscale} onClick={() => updateSettings({ greyscale: !settings.greyscale })} label="Greyscale pages" />
                  <CheckboxRow checked={settings.dimPages} onClick={() => updateSettings({ dimPages: !settings.dimPages })} label="Dim pages" />
                </div>
              </SettingsSection>
            </div>
          ) : null}

          {activeTab === "shortcuts" ? (
            <div className="space-y-4">
              <ShortcutSection title="Reader Chrome" rows={[{ keys: ["H"], label: "Toggle the top bar and bottom controls" }, { keys: ["double-click"], label: "Toggle the panels (centre of the page)" }]} />
              <ShortcutSection title="Page Navigation" rows={[{ keys: ["S", "K"], label: "Scroll down one screen" }, { keys: ["W", "I"], label: "Scroll up one screen" }]} />
              <ShortcutSection title="Chapter Navigation" rows={[{ keys: ["N"], label: "Next chapter" }, { keys: ["B"], label: "Previous chapter" }]} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#42484f]/70 pb-4 last:border-b-0 last:pb-0">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
    </section>
  );
}

function ControlButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="grid size-10 place-items-center rounded-lg border border-[#42484f] bg-[#3a4047] text-lg text-zinc-200 transition hover:border-cyan-300 hover:text-cyan-300">{children}</button>;
}

function RadioRow({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-lg border border-[#42484f] px-4 py-3 text-left text-sm transition ${active ? "bg-cyan-400/15 text-cyan-300" : "bg-[#3a4047] text-zinc-300 hover:text-zinc-100"}`}>
      <span className={`grid size-5 place-items-center rounded-full border ${active ? "border-cyan-300" : "border-zinc-500"}`}>{active ? <span className="size-2.5 rounded-full bg-cyan-300" /> : null}</span>
      <span>{label}</span>
    </button>
  );
}

function CheckboxRow({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-lg border border-[#42484f] px-4 py-3 text-left text-sm transition ${checked ? "bg-cyan-400/15 text-cyan-300" : "bg-[#3a4047] text-zinc-300 hover:text-zinc-100"}`}>
      <span className={`grid size-5 place-items-center rounded border text-xs font-bold ${checked ? "border-cyan-300 bg-cyan-300 text-zinc-950" : "border-zinc-500 text-transparent"}`}>✓</span>
      <span>{label}</span>
    </button>
  );
}

function ShortcutSection({ title, rows }: { title: string; rows: { keys: string[]; label: string }[] }) {
  return (
    <SettingsSection title={title}>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-2 rounded-lg border border-[#42484f] bg-[#3a4047] px-4 py-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {row.keys.map((key, index) => (
                <span key={key} className="contents">
                  {index > 0 ? <span>or</span> : null}
                  <kbd className="min-w-7 rounded-md border border-[#42484f] bg-[#3a4047] px-2 py-1 text-center text-xs font-semibold uppercase text-zinc-200 shadow-sm">{key}</kbd>
                </span>
              ))}
            </span>
            <span className="text-zinc-300">{row.label}</span>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function ReaderNavLink({ href, label, primary }: { href?: string; label: string; primary?: boolean }) {
  if (!href) {
    return <span className="cursor-not-allowed rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-600">{label}</span>;
  }
  const className = primary
    ? "rounded-lg bg-cyan-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-cyan-600"
    : "rounded-lg border border-zinc-600 bg-zinc-800 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700";
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
