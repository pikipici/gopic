"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import type { ChapterPage, ChapterSummary, SeriesSummary } from "@/lib/types";

type Envelope<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: null | { code: string; message: string };
};

type ChapterInput = {
  slug: string;
  numberLabel: string;
  numberSort: number;
  title: string;
  publishedAt: string;
};

type SourceSummary = { id: string; name: string };
type SourceResult = { sourceId: string; id: string; title: string; url: string; coverUrl: string };
type SourceDetail = SourceResult & { synopsis: string; type: string; status: string; authorName: string; artistName: string; releaseYear: number; genres: string[]; chapterCount: number };
type AdminJob = { id: string; type: string; status: "queued" | "running" | "completed" | "failed"; message: string; progress: number; payload?: Record<string, unknown>; createdAt?: string; updatedAt?: string; completedAt?: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8080";

function statusClass(status: AdminJob["status"]) {
  if (status === "completed") return "bg-lime-300/15 text-lime-200 ring-lime-300/20";
  if (status === "failed") return "bg-red-300/15 text-red-200 ring-red-300/20";
  if (status === "running") return "bg-sky-200/15 text-sky-100 ring-sky-200/20";
  return "bg-zinc-200/10 text-zinc-200 ring-white/10";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(date);
}

async function adminFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!response.ok || envelope.error) {
    throw new Error(envelope.error?.message ?? `Request failed with ${response.status}`);
  }
  return envelope.data;
}

function pagesFromText(value: string): ChapterPage[] {
  return value
    .split("\n")
    .map((line, index) => ({ pageNumber: index + 1, imageUrl: line.trim() }))
    .filter((page) => page.imageUrl !== "");
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [sourceQuery, setSourceQuery] = useState("neon");
  const [sourceResults, setSourceResults] = useState<SourceResult[]>([]);
  const [sourcePreview, setSourcePreview] = useState<SourceDetail | null>(null);
  const [importChapterLimit, setImportChapterLimit] = useState("2");
  const [importMetadataOnly, setImportMetadataOnly] = useState(false);
  const [importCachePages, setImportCachePages] = useState(true);
  const [activeJob, setActiveJob] = useState<AdminJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<AdminJob[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [chapter, setChapter] = useState<ChapterInput>({
    slug: "chapter-004",
    numberLabel: "Chapter 4",
    numberSort: 4,
    title: "Signal Bloom",
    publishedAt: new Date().toISOString(),
  });
  const [pageText, setPageText] = useState("/mock-pages/nighthawk-003-1.svg\n/mock-pages/nighthawk-003-2.svg");
  const [cbzFile, setCbzFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Masuk pakai ADMIN_TOKEN untuk mulai.");
  const [busy, setBusy] = useState(false);

  const selectedSeries = useMemo(
    () => series.find((item) => item.slug === selectedSlug),
    [selectedSlug, series],
  );
  const chapterLimitNumber = Number(importChapterLimit);
  const safeChapterLimit = Number.isFinite(chapterLimitNumber) && chapterLimitNumber > 0 ? Math.floor(chapterLimitNumber) : 0;
  const sourceNeedsLimit = Boolean(sourcePreview && sourcePreview.chapterCount > 100 && safeChapterLimit === 0 && !importMetadataOnly);

  const loadSeries = useCallback(async (authToken = savedToken) => {
    setBusy(true);
    try {
      const data = await adminFetch<SeriesSummary[]>("/api/v1/admin/series?limit=100", authToken);
      setSeries(data);
      setSelectedSlug((current) => current || data[0]?.slug || "");
      setMessage(`Loaded ${data.length} series dari admin API.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal load series.");
    } finally {
      setBusy(false);
    }
  }, [savedToken]);

  const loadSources = useCallback(async (authToken = savedToken) => {
    const data = await adminFetch<SourceSummary[]>("/api/v1/admin/sources", authToken);
    setSources(data);
    setActiveSourceId((current) => current || data[0]?.id || "");
    return data;
  }, [savedToken]);

  const loadJobs = useCallback(async (authToken = savedToken) => {
    const data = await adminFetch<AdminJob[]>("/api/v1/admin/jobs?limit=12", authToken);
    setRecentJobs(data);
    return data;
  }, [savedToken]);

  const watchJob = useCallback(async (job: AdminJob, authToken = savedToken) => {
    setActiveJob(job);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const latest = await adminFetch<AdminJob>(`/api/v1/admin/jobs/${job.id}`, authToken);
      setActiveJob(latest);
      setMessage(`${latest.type}: ${latest.message}`);
      if (latest.status === "completed") {
        await loadSeries(authToken);
        await loadJobs(authToken);
        return;
      }
      if (latest.status === "failed") {
        await loadJobs(authToken);
        throw new Error(latest.message);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("Job belum selesai setelah 30 detik.");
  }, [loadJobs, loadSeries, savedToken]);

  async function handleSourceSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const availableSources = sources.length > 0 ? sources : await loadSources(savedToken);
      const sourceID = activeSourceId || availableSources[0]?.id;
      if (!sourceID) {
        throw new Error("Belum ada source adapter aktif.");
      }
      const sourceLabel = availableSources.find((item) => item.id === sourceID)?.name ?? sourceID;
      const data = await adminFetch<SourceResult[]>(`/api/v1/admin/sources/${sourceID}/search?q=${encodeURIComponent(sourceQuery)}`, savedToken);
      setSourceResults(data);
      setSourcePreview(null);
      setMessage(`Ketemu ${data.length} judul dari ${sourceLabel}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal search source.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSourcePreview(result: SourceResult) {
    setBusy(true);
    try {
      const detail = await adminFetch<SourceDetail>(`/api/v1/admin/sources/${result.sourceId}/series/${result.id}`, savedToken);
      setSourcePreview(detail);
      setMessage(`Preview loaded: ${detail.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal load preview source.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceImport(result: SourceResult) {
    setBusy(true);
    try {
      const limitNumber = Number(importChapterLimit);
      if (importChapterLimit.trim() !== "" && (!Number.isFinite(limitNumber) || limitNumber < 0)) {
        throw new Error("Chapter limit harus angka 0 atau lebih.");
      }
      const chapterLimit = Number.isFinite(limitNumber) && limitNumber > 0 ? Math.floor(limitNumber) : 0;
      const body: { id: string; chapterLimit?: number; metadataOnly?: boolean; cachePages?: boolean } = { id: result.id };
      if (chapterLimit > 0) body.chapterLimit = chapterLimit;
      if (importMetadataOnly) body.metadataOnly = true;
      body.cachePages = importCachePages;
      const job = await adminFetch<AdminJob>(`/api/v1/admin/sources/${result.sourceId}/import`, savedToken, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const limitLabel = chapterLimit > 0 ? `latest ${chapterLimit} chapter` : "semua chapter";
      const pageLabel = importMetadataOnly ? "metadata only" : importCachePages ? "cache pages" : "upstream page URLs";
      setMessage(`${result.title} import queued (${limitLabel}, ${pageLabel}).`);
      await watchJob(job, savedToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal import source.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSeriesSync(slug: string) {
    setBusy(true);
    try {
      const job = await adminFetch<AdminJob>(`/api/v1/admin/series/${slug}/sync-source`, savedToken, { method: "POST" });
      setMessage(`${slug} sync queued.`);
      await watchJob(job, savedToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal sync source.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const envelope = (await response.json()) as Envelope<{ token: string }>;
      if (!response.ok || envelope.error) {
        throw new Error(envelope.error?.message ?? "Login gagal.");
      }
      window.localStorage.setItem("gomic-admin-token", envelope.data.token);
      setSavedToken(envelope.data.token);
      setMessage("Login sukses. Loading series dan source...");
      await loadSources(envelope.data.token);
      await loadSeries(envelope.data.token);
      await loadJobs(envelope.data.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function handleChapterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlug) {
      setMessage("Pilih series dulu.");
      return;
    }
    setBusy(true);
    try {
      const savedChapter = await adminFetch<ChapterSummary>(`/api/v1/admin/series/${selectedSlug}/chapters`, savedToken, {
        method: "POST",
        body: JSON.stringify(chapter),
      });
      setChapter((current) => ({ ...current, slug: savedChapter.slug }));
      setMessage(`Chapter ${savedChapter.numberLabel} tersimpan.`);
      await loadSeries(savedToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal simpan chapter.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePagesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlug || !chapter.slug) {
      setMessage("Pilih series dan isi slug chapter dulu.");
      return;
    }
    setBusy(true);
    try {
      const pages = pagesFromText(pageText);
      await adminFetch(`/api/v1/admin/series/${selectedSlug}/chapters/${chapter.slug}/pages`, savedToken, {
        method: "PUT",
        body: JSON.stringify({ pages }),
      });
      setMessage(`${pages.length} page tersimpan untuk ${chapter.slug}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal simpan pages.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCBZSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlug || !chapter.slug || !cbzFile) {
      setMessage("Pilih series, isi slug chapter, dan pilih file CBZ dulu.");
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", cbzFile);
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/series/${selectedSlug}/chapters/${chapter.slug}/import-cbz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${savedToken}` },
        body: formData,
      });
      const envelope = (await response.json()) as Envelope<unknown>;
      if (!response.ok || envelope.error) {
        throw new Error(envelope.error?.message ?? "Gagal import CBZ.");
      }
      setMessage(`CBZ imported untuk ${chapter.slug}. Page URL sudah diganti dari hasil extract.`);
      await loadSeries(savedToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal import CBZ.");
    } finally {
      setBusy(false);
    }
  }

  const linkedSeries = series.filter((item) => item.sourceId).length;
  const runningJobs = recentJobs.filter((job) => job.status === "queued" || job.status === "running").length;
  const failedJobs = recentJobs.filter((job) => job.status === "failed").length;
  const activeSourceName = sources.find((item) => item.id === activeSourceId)?.name ?? (activeSourceId || "No source");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(190,242,100,0.18),rgba(17,17,22,0.95)_42%,rgba(59,130,246,0.16))] p-6 shadow-2xl shadow-black/30 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-accent">Gomic cockpit</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Admin chapter forge</h1>
            <p className="mt-4 text-base text-muted md:text-lg">
              Simpan chapter baru, lalu tempel daftar URL page. Semua route tetap dilindungi bearer token API.
            </p>
          </div>
          <form onSubmit={handleLogin} className="flex w-full flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-4 lg:max-w-sm">
            <label className="text-sm font-semibold text-muted" htmlFor="token">
              Admin token
            </label>
            <input
              id="token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="dev-token"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none transition focus:border-accent"
              type="password"
            />
            <button disabled={busy || !token} className="rounded-2xl bg-accent px-4 py-3 font-bold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
              Login / refresh
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Series" value={String(series.length)} hint={`${linkedSeries} linked source`} />
        <StatCard label="Sources" value={String(sources.length)} hint={activeSourceName} />
        <StatCard label="Active jobs" value={String(runningJobs)} hint="queued / running" />
        <StatCard label="Failed jobs" value={String(failedJobs)} hint="recent window" tone={failedJobs > 0 ? "danger" : "default"} />
      </section>

      <div className={`rounded-3xl border p-4 text-sm ${busy ? "border-sky-200/25 bg-sky-200/[0.06] text-sky-100" : "border-white/10 bg-surface/80 text-muted"}`}>
        <div className="flex items-center justify-between gap-3">
          <span>{busy ? "Loading..." : message}</span>
          <span className="hidden rounded-full border border-white/10 px-2 py-1 font-mono text-[0.65rem] text-muted sm:inline">{apiBaseUrl}</span>
        </div>
      </div>

      {activeJob ? (
        <div className="rounded-3xl border border-sky-200/20 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.16),rgba(14,20,29,0.82)_42%)] p-4 shadow-xl shadow-sky-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-sky-200">Current job</p>
              <h2 className="mt-1 font-black text-sky-50">{activeJob.type}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${statusClass(activeJob.status)}`}>{activeJob.status}</span>
              <span className="font-mono text-sm text-muted">{activeJob.progress}%</span>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-sky-200 transition-all duration-500" style={{ width: `${activeJob.progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted">{activeJob.message}</p>
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-surface/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-accent">Job history</p>
            <h2 className="mt-2 text-xl font-black">Recent admin jobs</h2>
          </div>
          <button onClick={() => void loadJobs()} disabled={!savedToken || busy} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-muted hover:text-white disabled:opacity-40">
            Refresh jobs
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recentJobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-white/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{job.type.replace("_", " ")}</h3>
                  <p className="mt-1 truncate font-mono text-[0.7rem] text-muted">{job.id}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${statusClass(job.status)}`}>{job.status}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${job.status === "failed" ? "bg-red-300" : "bg-accent"}`} style={{ width: `${job.progress}%` }} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{job.message}</p>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>Updated {formatDate(job.updatedAt)}</span>
                {job.completedAt ? <span>Done {formatDate(job.completedAt)}</span> : null}
              </div>
            </article>
          ))}
          {recentJobs.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted">Belum ada job. Import atau sync source dulu.</p> : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sky-300/20 bg-sky-300/[0.06] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-sky-200">Mihon bridge</p>
            <h2 className="text-xl font-black">Import dari source adapter</h2>
            <p className="text-sm text-muted">Flow aman: pilih source, search judul, preview metadata, lalu queue import job.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-sky-100">
            <span className="rounded-full border border-sky-200/20 bg-sky-200/10 px-3 py-1">1 Search</span>
            <span className="rounded-full border border-sky-200/20 bg-sky-200/10 px-3 py-1">2 Preview</span>
            <span className="rounded-full border border-sky-200/20 bg-sky-200/10 px-3 py-1">3 Import</span>
          </div>
        </div>
        <form onSubmit={handleSourceSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <select
            value={activeSourceId}
            onChange={(event) => setActiveSourceId(event.target.value)}
            disabled={!savedToken || busy || sources.length === 0}
            className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-200 disabled:opacity-50"
          >
            {sources.length === 0 ? <option value="">No source</option> : null}
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            value={sourceQuery}
            onChange={(event) => setSourceQuery(event.target.value)}
            placeholder="Cari judul dari source"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-200"
          />
          <button disabled={!savedToken || busy} className="rounded-2xl bg-sky-200 px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
            Search source
          </button>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sourceResults.map((result) => (
            <article key={`${result.sourceId}-${result.id}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-sky-200/30">
              <img src={result.coverUrl} alt="" width={56} height={80} className="h-20 w-14 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">{result.title}</h3>
                <p className="mt-1 truncate text-xs text-muted">{result.sourceId} / {result.id}</p>
                <p className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-sky-100">Ready to preview</p>
              </div>
              <button onClick={() => void handleSourcePreview(result)} disabled={!savedToken || busy} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black transition hover:bg-sky-200 disabled:opacity-50">
                Preview
              </button>
            </article>
          ))}
        </div>
        {sourcePreview ? (
          <article className="mt-5 grid gap-4 rounded-3xl border border-white/10 bg-black/25 p-4 shadow-xl shadow-black/20 md:grid-cols-[96px_1fr] xl:grid-cols-[96px_1fr_320px]">
            <img src={sourcePreview.coverUrl} alt="" width={96} height={136} className="h-[136px] w-24 rounded-2xl object-cover" />
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-sky-200">Preview loaded</p>
              <h3 className="mt-1 text-2xl font-black">{sourcePreview.title}</h3>
              <p className="mt-2 text-sm text-muted">{sourcePreview.synopsis}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted">
                <span className="rounded-full bg-white/10 px-2 py-1">{sourcePreview.chapterCount} chapters</span>
                <span className="rounded-full bg-white/10 px-2 py-1">{sourcePreview.status}</span>
                <span className="rounded-full bg-white/10 px-2 py-1">{sourcePreview.type}</span>
              </div>
              <p className="mt-3 text-xs text-muted">{sourcePreview.genres.join(", ")}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.06] p-4 md:col-span-2 xl:col-span-1">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-sky-200">Import safety</p>
              <label className="mt-3 block text-sm font-semibold text-muted">
                Chapter limit
                <input
                  value={importChapterLimit}
                  onChange={(event) => setImportChapterLimit(event.target.value)}
                  type="number"
                  min="0"
                  placeholder="0 = semua"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-200"
                />
              </label>
              <label className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted">
                <input type="checkbox" checked={importMetadataOnly} onChange={(event) => setImportMetadataOnly(event.target.checked)} className="h-4 w-4 accent-sky-200" />
                Metadata only
              </label>
              <label className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted">
                <input type="checkbox" checked={importCachePages} onChange={(event) => setImportCachePages(event.target.checked)} disabled={importMetadataOnly} className="h-4 w-4 accent-sky-200 disabled:opacity-40" />
                Cache pages locally
              </label>
              {sourceNeedsLimit ? <p className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-xs font-semibold text-amber-100">Seri ini besar. Isi chapter limit atau aktifkan metadata-only supaya import tidak terlalu lama.</p> : null}
              <button onClick={() => void handleSourceImport(sourcePreview)} disabled={!savedToken || busy || sourceNeedsLimit} className="mt-4 w-full rounded-2xl bg-accent px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
                Queue import
              </button>
            </div>
          </article>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-[1.75rem] border border-white/10 bg-surface/80 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Series target</h2>
            <button onClick={() => void loadSeries()} disabled={!savedToken || busy} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-muted hover:text-white disabled:opacity-40">
              Reload
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {series.map((item) => (
              <article key={item.slug} className={`rounded-2xl border p-4 transition ${selectedSlug === item.slug ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                <button onClick={() => setSelectedSlug(item.slug)} className="block w-full text-left">
                  <span className="block font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted">{item.slug} · {item.chapterCount} chapters</span>
                  {item.sourceId ? <span className="mt-2 inline-flex rounded-full bg-sky-200/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-200">{item.sourceId}</span> : null}
                </button>
                {item.sourceId ? (
                  <button onClick={() => void handleSeriesSync(item.slug)} disabled={!savedToken || busy} className="mt-3 rounded-xl border border-sky-200/30 px-3 py-2 text-xs font-black text-sky-100 transition hover:bg-sky-200 hover:text-black disabled:opacity-40">
                    Sync
                  </button>
                ) : null}
              </article>
            ))}
            {series.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted">Belum ada data. Login atau nyalakan API.</p> : null}
          </div>
        </aside>

        <div className="grid gap-6">
          <form onSubmit={handleChapterSubmit} className="rounded-[1.75rem] border border-white/10 bg-surface/80 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black">1. Chapter detail</h2>
              <p className="text-sm text-muted">Target: {selectedSeries?.title ?? "belum dipilih"}</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Slug" value={chapter.slug} onChange={(value) => setChapter((current) => ({ ...current, slug: value }))} />
              <Field label="Number label" value={chapter.numberLabel} onChange={(value) => setChapter((current) => ({ ...current, numberLabel: value }))} />
              <Field label="Number sort" value={String(chapter.numberSort)} type="number" onChange={(value) => setChapter((current) => ({ ...current, numberSort: Number(value) }))} />
              <Field label="Published at" value={chapter.publishedAt} onChange={(value) => setChapter((current) => ({ ...current, publishedAt: value }))} />
              <div className="sm:col-span-2">
                <Field label="Title" value={chapter.title} onChange={(value) => setChapter((current) => ({ ...current, title: value }))} />
              </div>
            </div>
            <button disabled={!savedToken || !selectedSlug || busy} className="mt-5 rounded-2xl bg-white px-5 py-3 font-black text-black transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
              Save chapter
            </button>
          </form>

          <form onSubmit={handlePagesSubmit} className="rounded-[1.75rem] border border-white/10 bg-surface/80 p-5">
            <h2 className="text-xl font-black">2. Page URLs</h2>
            <p className="mt-1 text-sm text-muted">Satu URL per baris. Nomor halaman dibuat otomatis dari urutan baris.</p>
            <textarea
              value={pageText}
              onChange={(event) => setPageText(event.target.value)}
              rows={8}
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm outline-none transition focus:border-accent"
            />
            <button disabled={!savedToken || !selectedSlug || !chapter.slug || busy} className="mt-5 rounded-2xl bg-accent px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
              Replace pages
            </button>
          </form>

          <form onSubmit={handleCBZSubmit} className="rounded-[1.75rem] border border-lime-300/20 bg-lime-300/[0.06] p-5">
            <h2 className="text-xl font-black">3. Import CBZ / ZIP</h2>
            <p className="mt-1 text-sm text-muted">Upload archive berisi image. Backend extract, sort nama file, lalu replace pages chapter aktif.</p>
            <input
              type="file"
              accept=".cbz,.zip"
              onChange={(event) => setCbzFile(event.target.files?.[0] ?? null)}
              className="mt-5 block w-full cursor-pointer rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-black"
            />
            <button disabled={!savedToken || !selectedSlug || !chapter.slug || !cbzFile || busy} className="mt-5 rounded-2xl bg-accent px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
              Import CBZ
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: "default" | "danger" }) {
  const toneClass = tone === "danger" ? "border-red-300/20 bg-red-300/[0.06] text-red-100" : "border-white/10 bg-surface/80 text-white";
  return (
    <article className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 truncate text-xs text-muted">{hint}</p>
    </article>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm font-semibold text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-accent"
      />
    </label>
  );
}
