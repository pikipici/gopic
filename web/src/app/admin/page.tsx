"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
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

type SourceSummary = { id: string; name: string; kind?: string; baseUrl?: string; enabled?: boolean; capabilities?: string[]; lastError?: string; updatedAt?: string };
type AvailableSourceExtension = { id: string; name: string; kind: string; baseUrl: string; description: string; language: string; version?: string; author?: string; homepage?: string; capabilities: string[] };
type SourceExtensionForm = { id: string; name: string; baseUrl: string; enabled: boolean; headersJSON: string; editingID: string };
type SourceStatus = { id: string; name: string; healthy: boolean; message: string; enabled: boolean };
type SourceResult = { sourceId: string; id: string; title: string; url: string; coverUrl: string };
type SourceDetail = SourceResult & { synopsis: string; type: string; status: string; authorName: string; artistName: string; releaseYear: number; genres: string[]; chapterCount: number };
type AdminJob = { id: string; type: string; status: "queued" | "running" | "completed" | "failed"; message: string; progress: number; payload?: Record<string, unknown>; createdAt?: string; updatedAt?: string; completedAt?: string };
type JobFilter = "all" | "running" | "failed" | "completed";
type CoverStatus = "cached" | "upstream" | "none";
type ImportPreset = {
  key: string;
  label: string;
  description: string;
  chapterLimit: string;
  metadataOnly: boolean;
  cachePages: boolean;
};
type Toast = { id: string; tone: "info" | "success" | "error"; title: string; message: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8080";
const jobFilters: { key: JobFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
  { key: "completed", label: "Completed" },
];
const sourceSearchPresets: Record<string, string[]> = {
  komikcast: ["one piece", "spy x family", "academy"],
  komikindo: ["villainess", "solo leveling", "academy"],
  "mock-mihon": ["neon", "nighthawk", "oracle"],
};
const fallbackSourcePresets = ["one piece", "academy", "villainess"];
const importPresets: ImportPreset[] = [
  { key: "metadata", label: "Metadata only", description: "Cover + info, no chapter pages.", chapterLimit: "0", metadataOnly: true, cachePages: false },
  { key: "one", label: "1 chapter", description: "Latest chapter, safer smoke test.", chapterLimit: "1", metadataOnly: false, cachePages: true },
  { key: "two", label: "2 chapters", description: "Default small import batch.", chapterLimit: "2", metadataOnly: false, cachePages: true },
  { key: "all", label: "All chapters", description: "Full import; use carefully.", chapterLimit: "0", metadataOnly: false, cachePages: true },
];

function statusClass(status: AdminJob["status"]) {
  if (status === "completed") return "bg-lime-300/15 text-lime-200 ring-lime-300/20";
  if (status === "failed") return "bg-red-300/15 text-red-200 ring-red-300/20";
  if (status === "running") return "bg-sky-200/15 text-sky-100 ring-sky-200/20";
  return "bg-zinc-200/10 text-zinc-200 ring-white/10";
}

function coverStatus(coverUrl: string): CoverStatus {
  if (!coverUrl) return "none";
  if (coverUrl.startsWith("/uploads/source-cache/")) return "cached";
  return "upstream";
}

function coverStatusMeta(status: CoverStatus) {
  if (status === "cached") {
    return { label: "Cached cover", className: "bg-lime-300/15 text-lime-200 ring-lime-300/20", hint: "Local cache aktif." };
  }
  if (status === "upstream") {
    return { label: "Upstream cover", className: "bg-amber-300/15 text-amber-100 ring-amber-300/20", hint: "Sync cover buat pindah ke cache lokal." };
  }
  return { label: "No cover", className: "bg-zinc-200/10 text-zinc-300 ring-white/10", hint: "Belum ada cover URL." };
}

function toastClass(tone: Toast["tone"]) {
  if (tone === "success") return "border-lime-300/25 bg-lime-300/10 text-lime-50 shadow-lime-950/30";
  if (tone === "error") return "border-red-300/25 bg-red-300/10 text-red-50 shadow-red-950/30";
  return "border-sky-200/25 bg-sky-200/10 text-sky-50 shadow-sky-950/30";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(date);
}

function formatJobType(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function jobSeriesID(job: AdminJob | null) {
  const value = job?.payload?.sourceSeriesId;
  return typeof value === "string" ? value : "";
}

function jobSyncSlug(job: AdminJob | null) {
  const value = job?.payload?.slug;
  return typeof value === "string" ? value : "";
}

function isRetryableJob(job: AdminJob | null) {
  return job?.status === "failed" && (job.type === "source_import" || (job.type === "source_sync" && Boolean(jobSyncSlug(job))));
}

function formatPayloadValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value, null, 2);
}

function friendlyJobMessage(job: AdminJob | null) {
  const raw = job?.message?.trim();
  if (!raw) return "Belum ada message dari job.";
  if (job?.status !== "failed") return raw;

  const lower = raw.toLowerCase();
  if (lower.includes("interrupted by api restart")) return "Job kepotong karena API restart. Aman buat retry kalau source masih available.";
  if (lower.includes("timeout") || lower.includes("deadline exceeded")) return "Source atau image host timeout. Coba retry metadata-only dulu, atau cek scraper/source sebelum full sync.";
  if (lower.includes("connection refused") || lower.includes("connectex") || lower.includes("no connection could be made")) return "Adapter/source tidak bisa dihubungi. Cek dev stack, port scraper, atau source availability.";
  if (lower.includes("no such host") || lower.includes("dns")) return "Host source tidak bisa di-resolve. Cek koneksi atau endpoint scraper/source.";
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden")) return "Request ditolak oleh source atau admin auth. Cek token/source access, lalu retry.";
  if (lower.includes("404") || lower.includes("not found")) return "Target source/series/chapter tidak ditemukan. Cek payload di detail sebelum retry.";
  return "Job gagal. Buka Detail untuk raw error dan payload, lalu retry kalau payload masih valid.";
}

function presetsForSource(sourceId: string) {
  return sourceSearchPresets[sourceId] ?? fallbackSourcePresets;
}

function sourceEnabled(source?: Pick<SourceSummary, "enabled">) {
  return source?.enabled !== false;
}

function sourceHealthClass(status?: SourceStatus) {
  if (!status) return "bg-zinc-200/10 text-zinc-300 ring-white/10";
  if (!status.enabled) return "bg-zinc-200/10 text-zinc-300 ring-white/10";
  if (status.healthy) return "bg-lime-300/15 text-lime-200 ring-lime-300/20";
  return "bg-red-300/15 text-red-100 ring-red-300/20";
}

function sourceHealthLabel(source: SourceSummary, status?: SourceStatus) {
  if (!sourceEnabled(source)) return "Disabled";
  if (!status) return "Status unknown";
  return status.healthy ? "Healthy" : "Unhealthy";
}

function extensionFormFromSource(source: SourceSummary): SourceExtensionForm {
  return { id: source.id, name: source.name, baseUrl: source.baseUrl ?? "", enabled: sourceEnabled(source), headersJSON: "{}", editingID: source.id };
}

function emptyExtensionForm(): SourceExtensionForm {
  return { id: "", name: "", baseUrl: "", enabled: true, headersJSON: "{}", editingID: "" };
}

function parseHeadersJSON(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") return undefined;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Headers config harus object JSON.");
  const headers: Record<string, string> = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (typeof item !== "string") throw new Error("Header values harus string.");
    if (key.trim() && item) headers[key.trim()] = item;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
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
  const [availableSources, setAvailableSources] = useState<AvailableSourceExtension[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, SourceStatus>>({});
  const [sourceForm, setSourceForm] = useState<SourceExtensionForm>(() => emptyExtensionForm());
  const [activeSourceId, setActiveSourceId] = useState("");
  const [sourceQuery, setSourceQuery] = useState("neon");
  const [sourceResults, setSourceResults] = useState<SourceResult[]>([]);
  const [sourcePreview, setSourcePreview] = useState<SourceDetail | null>(null);
  const [importChapterLimit, setImportChapterLimit] = useState("2");
  const [importMetadataOnly, setImportMetadataOnly] = useState(false);
  const [importCachePages, setImportCachePages] = useState(true);
  const [syncChapterLimit, setSyncChapterLimit] = useState("0");
  const [syncMetadataOnly, setSyncMetadataOnly] = useState(true);
  const [syncCachePages, setSyncCachePages] = useState(true);
  const [activeJob, setActiveJob] = useState<AdminJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<AdminJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastID = useRef(0);

  const pushToast = (toast: Omit<Toast, "id">) => {
    nextToastID.current += 1;
    const id = `toast-${nextToastID.current}`;
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5000);
  };

  const selectedSeries = useMemo(
    () => series.find((item) => item.slug === selectedSlug),
    [selectedSlug, series],
  );
  const chapterLimitNumber = Number(importChapterLimit);
  const safeChapterLimit = Number.isFinite(chapterLimitNumber) && chapterLimitNumber > 0 ? Math.floor(chapterLimitNumber) : 0;
  const activeImportPreset = importPresets.find(
    (preset) => preset.chapterLimit === String(safeChapterLimit) && preset.metadataOnly === importMetadataOnly && preset.cachePages === importCachePages,
  );
  const sourceNeedsLimit = Boolean(sourcePreview && sourcePreview.chapterCount > 100 && safeChapterLimit === 0 && !importMetadataOnly);

  function applyImportPreset(preset: ImportPreset) {
    setImportChapterLimit(preset.chapterLimit);
    setImportMetadataOnly(preset.metadataOnly);
    setImportCachePages(preset.cachePages);
  }

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
    setActiveSourceId((current) => {
      if (current && data.some((item) => item.id === current && sourceEnabled(item))) return current;
      return data.find(sourceEnabled)?.id || data[0]?.id || "";
    });
    return data;
  }, [savedToken]);

  const loadAvailableSources = useCallback(async (authToken = savedToken) => {
    const data = await adminFetch<AvailableSourceExtension[]>("/api/v1/admin/extensions/catalog", authToken);
    setAvailableSources(data);
    return data;
  }, [savedToken]);

  const loadSourceStatus = useCallback(async (sourceID: string, authToken = savedToken) => {
    const status = await adminFetch<SourceStatus>(`/api/v1/admin/extensions/${sourceID}/status`, authToken);
    setSourceStatuses((current) => ({ ...current, [sourceID]: status }));
    return status;
  }, [savedToken]);

  const loadSourceStatuses = useCallback(async (items: SourceSummary[] = sources, authToken = savedToken) => {
    const statuses = await Promise.allSettled(items.map((source) => loadSourceStatus(source.id, authToken)));
    const failed = statuses.filter((status) => status.status === "rejected").length;
    if (failed > 0) {
      pushToast({ tone: "error", title: "Status partial", message: `${failed} source status gagal dimuat.` });
    }
  }, [loadSourceStatus, savedToken, sources]);

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
      const activeSource = availableSources.find((item) => item.id === sourceID);
      if (activeSource && !sourceEnabled(activeSource)) {
        throw new Error("Source extension lagi disabled. Enable dulu sebelum search/import.");
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
    setSourcePreview(null);
    setMessage(`Loading preview: ${result.title}...`);
    try {
      const detail = await adminFetch<SourceDetail>(`/api/v1/admin/sources/${result.sourceId}/series/${result.id}`, savedToken);
      setSourcePreview(detail);
      setMessage(`Preview loaded: ${detail.title}.`);
      pushToast({ tone: "success", title: "Preview loaded", message: `${detail.title} (${detail.chapterCount} chapter)` });
      window.requestAnimationFrame(() => document.getElementById("source-preview-card")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal load preview source.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Preview failed", message: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceImport(result: SourceResult) {
    setBusy(true);
    try {
      const source = sources.find((item) => item.id === result.sourceId);
      if (source && !sourceEnabled(source)) {
        throw new Error("Source extension lagi disabled. Enable dulu sebelum import.");
      }
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
      const pageLabel = importMetadataOnly ? "metadata only" : importCachePages ? "cache images" : "upstream image URLs";
      setMessage(`${result.title} import queued (${limitLabel}, ${pageLabel}).`);
      pushToast({ tone: "info", title: "Import queued", message: `${result.title} (${limitLabel}, ${pageLabel})` });
      await watchJob(job, savedToken);
      pushToast({ tone: "success", title: "Import completed", message: `${result.id} siap dibuka di reader.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal import source.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Import failed", message: friendlyJobMessage({ id: "", type: "source_import", status: "failed", message: errorMessage, progress: 0 }) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSeriesSync(slug: string) {
    setBusy(true);
    try {
      const limitNumber = Number(syncChapterLimit);
      if (syncChapterLimit.trim() !== "" && (!Number.isFinite(limitNumber) || limitNumber < 0)) {
        throw new Error("Sync chapter limit harus angka 0 atau lebih.");
      }
      const chapterLimit = Number.isFinite(limitNumber) && limitNumber > 0 ? Math.floor(limitNumber) : 0;
      const body: { chapterLimit?: number; metadataOnly?: boolean; cachePages?: boolean } = {};
      if (chapterLimit > 0) body.chapterLimit = chapterLimit;
      if (syncMetadataOnly) body.metadataOnly = true;
      body.cachePages = syncCachePages;
      const job = await adminFetch<AdminJob>(`/api/v1/admin/series/${slug}/sync-source`, savedToken, { method: "POST", body: JSON.stringify(body) });
      const modeLabel = syncMetadataOnly ? "metadata/cover only" : chapterLimit > 0 ? `latest ${chapterLimit} chapter` : "full chapter sync";
      setMessage(`${slug} sync queued (${modeLabel}).`);
      pushToast({ tone: "info", title: "Sync queued", message: `${slug} (${modeLabel})` });
      await watchJob(job, savedToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal sync source.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Sync failed", message: friendlyJobMessage({ id: "", type: "source_sync", status: "failed", message: errorMessage, progress: 0 }) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceStatusRefresh(sourceID: string) {
    setBusy(true);
    try {
      const status = await loadSourceStatus(sourceID, savedToken);
      setMessage(`${status.name} status: ${status.healthy ? "healthy" : "unhealthy"}.`);
      pushToast({ tone: status.healthy ? "success" : "error", title: "Source status", message: status.message || status.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal load source status.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Status failed", message: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceToggle(source: SourceSummary) {
    setBusy(true);
    try {
      const enabled = !sourceEnabled(source);
      const updated = await adminFetch<SourceSummary>(`/api/v1/admin/extensions/${source.id}`, savedToken, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setSources((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSourceStatuses((current) => ({
        ...current,
        [updated.id]: current[updated.id] ? { ...current[updated.id], enabled: updated.enabled !== false } : current[updated.id],
      }));
      if (!enabled && activeSourceId === updated.id) {
        const nextSource = sources.find((item) => item.id !== updated.id && sourceEnabled(item));
        setActiveSourceId(nextSource?.id || updated.id);
      }
      setMessage(`${updated.name} ${enabled ? "enabled" : "disabled"}.`);
      pushToast({ tone: "success", title: enabled ? "Source enabled" : "Source disabled", message: updated.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal update source extension.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Source update failed", message: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceExtensionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const headers = parseHeadersJSON(sourceForm.headersJSON);
      const payload: Record<string, unknown> = {
        name: sourceForm.name,
        baseUrl: sourceForm.baseUrl,
        enabled: sourceForm.enabled,
      };
      if (headers) payload.config = { headers };
      const editing = Boolean(sourceForm.editingID);
      if (!editing) {
        payload.id = sourceForm.id;
        payload.kind = "json-http";
      }
      const updated = await adminFetch<SourceSummary>(editing ? `/api/v1/admin/extensions/${sourceForm.editingID}` : "/api/v1/admin/extensions", savedToken, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      const loaded = await loadSources(savedToken);
      setActiveSourceId(updated.enabled === false ? loaded.find(sourceEnabled)?.id || updated.id : updated.id);
      setSourceForm(emptyExtensionForm());
      await loadSourceStatus(updated.id, savedToken);
      setMessage(`${updated.name} ${editing ? "updated" : "created"}.`);
      pushToast({ tone: "success", title: editing ? "Source updated" : "Source created", message: updated.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal simpan source extension.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Source save failed", message: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceInstall(extensionID: string) {
    setBusy(true);
    try {
      const installed = await adminFetch<SourceSummary>(`/api/v1/admin/extensions/catalog/${extensionID}/install`, savedToken, { method: "POST" });
      const loaded = await loadSources(savedToken);
      setActiveSourceId(installed.enabled === false ? loaded.find(sourceEnabled)?.id || installed.id : installed.id);
      await loadSourceStatus(installed.id, savedToken);
      setMessage(`${installed.name} installed. Source sudah bisa dipilih untuk search/import.`);
      pushToast({ tone: "success", title: "Source installed", message: installed.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal install source extension.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Install failed", message: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleSourceDelete(source: SourceSummary) {
    if (!window.confirm(`Delete source ${source.name}? Imported series yang sudah link ke source ini tidak ikut dihapus.`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/extensions/${source.id}`, savedToken, { method: "DELETE" });
      const loaded = await loadSources(savedToken);
      setSourceStatuses((current) => {
        const next = { ...current };
        delete next[source.id];
        return next;
      });
      if (activeSourceId === source.id) setActiveSourceId(loaded.find(sourceEnabled)?.id || loaded[0]?.id || "");
      if (sourceForm.editingID === source.id) setSourceForm(emptyExtensionForm());
      setMessage(`${source.name} deleted.`);
      pushToast({ tone: "success", title: "Source deleted", message: source.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal delete source extension.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Source delete failed", message: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleCoverSync(slug: string) {
    setBusy(true);
    try {
      const body = { metadataOnly: true, cachePages: false };
      const job = await adminFetch<AdminJob>(`/api/v1/admin/series/${slug}/sync-source`, savedToken, { method: "POST", body: JSON.stringify(body) });
      setMessage(`${slug} cover sync queued (metadata/cover only).`);
      pushToast({ tone: "info", title: "Cover sync queued", message: `${slug} metadata-only sync` });
      await watchJob(job, savedToken);
      pushToast({ tone: "success", title: "Cover sync completed", message: `${slug} siap dicek cache cover.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal sync cover.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Cover sync failed", message: friendlyJobMessage({ id: "", type: "source_sync", status: "failed", message: errorMessage, progress: 0 }) });
    } finally {
      setBusy(false);
    }
  }

  async function handleJobRetry(job: AdminJob) {
    setBusy(true);
    try {
      let retry: AdminJob;
      let retryLabel = jobSeriesID(job) || job.id;
      if (job.type === "source_sync") {
        const slug = jobSyncSlug(job);
        if (!slug) throw new Error("Job sync tidak punya slug di payload.");
        const metadataOnly = typeof job.payload?.metadataOnly === "boolean" ? job.payload.metadataOnly : true;
        const cachePages = metadataOnly ? false : typeof job.payload?.cachePages === "boolean" ? job.payload.cachePages : false;
        const chapterLimit = typeof job.payload?.chapterLimit === "number" && job.payload.chapterLimit > 0 ? job.payload.chapterLimit : undefined;
        const body: { chapterLimit?: number; metadataOnly?: boolean; cachePages?: boolean } = { cachePages };
        if (metadataOnly) body.metadataOnly = true;
        if (chapterLimit) body.chapterLimit = chapterLimit;
        retry = await adminFetch<AdminJob>(`/api/v1/admin/series/${slug}/sync-source`, savedToken, { method: "POST", body: JSON.stringify(body) });
        retryLabel = slug;
      } else {
        retry = await adminFetch<AdminJob>(`/api/v1/admin/jobs/${job.id}/retry`, savedToken, { method: "POST" });
      }
      setSelectedJob(retry);
      setMessage(`Retry queued for ${retryLabel}.`);
      pushToast({ tone: "info", title: "Retry queued", message: friendlyJobMessage(job) });
      await watchJob(retry, savedToken);
      pushToast({ tone: "success", title: "Retry completed", message: `${jobSeriesID(retry) || jobSyncSlug(retry) || retry.id} siap dicek lagi.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal retry job.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Retry failed", message: friendlyJobMessage({ id: "", type: "source_import", status: "failed", message: errorMessage, progress: 0 }) });
    } finally {
      setBusy(false);
    }
  }

  async function handleJobDetail(job: AdminJob) {
    setSelectedJob(job);
    try {
      const detail = await adminFetch<AdminJob>(`/api/v1/admin/jobs/${job.id}`, savedToken);
      setSelectedJob(detail);
      setRecentJobs((current) => current.map((item) => (item.id === detail.id ? detail : item)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal load detail job.";
      setMessage(errorMessage);
      pushToast({ tone: "error", title: "Job detail failed", message: errorMessage });
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
      await loadAvailableSources(envelope.data.token);
      const loadedSources = await loadSources(envelope.data.token);
      await loadSourceStatuses(loadedSources, envelope.data.token);
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
  const completedJobs = recentJobs.filter((job) => job.status === "completed").length;
  const visibleJobs = recentJobs.filter((job) => {
    if (jobFilter === "all") return true;
    if (jobFilter === "running") return job.status === "queued" || job.status === "running";
    return job.status === jobFilter;
  });
  const jobFilterCounts: Record<JobFilter, number> = {
    all: recentJobs.length,
    running: runningJobs,
    failed: failedJobs,
    completed: completedJobs,
  };
  const emptyJobMessage = jobFilter === "all" ? "Belum ada job. Import atau sync source dulu." : `Tidak ada ${jobFilter} job di recent window.`;
  const activeSourceName = sources.find((item) => item.id === activeSourceId)?.name ?? (activeSourceId || "No source");
  const installedSourceIDs = new Set(sources.map((item) => item.id));
  const activeSourcePresets = presetsForSource(activeSourceId);
  const activeJobSeriesID = jobSeriesID(activeJob);
  const activeJobLatestChapter = activeJobSeriesID ? series.find((item) => item.slug === activeJobSeriesID)?.latestChapter?.slug : undefined;
  const activeJobDone = activeJob?.status === "completed" && activeJobSeriesID;
  const activeJobRunning = activeJob?.status === "queued" || activeJob?.status === "running";
  const selectedJobPayload = selectedJob?.payload ? Object.entries(selectedJob.payload) : [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-4 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.24),transparent_34%),linear-gradient(135deg,rgba(17,17,22,0.96),rgba(7,7,10,0.94)_58%,rgba(59,130,246,0.18))] p-4 shadow-2xl shadow-black/30 sm:rounded-[2.25rem] sm:p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-accent sm:text-xs sm:tracking-[0.4em]">Gomic cockpit</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:mt-4 sm:text-4xl md:text-6xl">Admin chapter forge</h1>
            <p className="mt-4 text-base text-muted md:text-lg">
              Search source, preview metadata, queue import, retry failed jobs, dan raw chapter tools dalam satu cockpit.
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Series" value={String(series.length)} hint={`${linkedSeries} linked source`} />
        <StatCard label="Sources" value={String(sources.length)} hint={activeSourceName} />
        <StatCard label="Active jobs" value={String(runningJobs)} hint="queued / running" />
        <StatCard label="Failed jobs" value={String(failedJobs)} hint="recent window" tone={failedJobs > 0 ? "danger" : "default"} />
      </section>

      <div className={`rounded-3xl border p-4 text-sm ${busy ? "border-sky-200/25 bg-sky-200/[0.06] text-sky-100" : "border-white/10 bg-surface/80 text-muted"}`}>
        <div className="flex items-center justify-between gap-3">
          <span>{busy ? `Working... ${message}` : message}</span>
          <span className="hidden rounded-full border border-white/10 px-2 py-1 font-mono text-[0.65rem] text-muted sm:inline">{apiBaseUrl}</span>
        </div>
      </div>

      {activeJob ? (
        <div className="rounded-3xl border border-sky-200/20 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.16),rgba(14,20,29,0.82)_42%)] p-4 shadow-xl shadow-sky-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-sky-200">Current job</p>
              <h2 className="mt-1 font-black text-sky-50">{formatJobType(activeJob.type)}</h2>
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
          {activeJobRunning ? (
            <div className="mt-4 rounded-2xl border border-sky-200/20 bg-sky-200/10 p-3 text-sm font-semibold text-sky-50">
              Import masih diproses. Jangan refresh dulu; progress akan update otomatis.
            </div>
          ) : null}
          {activeJobDone ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-lime-300/25 bg-lime-300/10 p-4 text-sm text-lime-50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">Import berhasil: {activeJobSeriesID}</p>
                <p className="mt-1 text-lime-100/80">Series sudah masuk katalog. Buka langsung untuk cek hasil import.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/series/${activeJobSeriesID}`} className="rounded-full bg-lime-200 px-3 py-2 text-xs font-black text-black transition hover:scale-[1.02]">Open series</a>
                {activeJobLatestChapter ? <a href={`/series/${activeJobSeriesID}/${activeJobLatestChapter}`} className="rounded-full border border-lime-200/40 px-3 py-2 text-xs font-black text-lime-50 transition hover:bg-lime-200 hover:text-black">Open latest chapter</a> : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),rgba(255,255,255,0.04)] p-4 shadow-xl shadow-black/20 sm:rounded-[1.75rem] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-accent">Job history</p>
            <h2 className="mt-2 text-xl font-black">Recent admin jobs</h2>
          </div>
          <button onClick={() => void loadJobs()} disabled={!savedToken || busy} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-muted hover:text-white disabled:opacity-40">
            Refresh jobs
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {jobFilters.map((filter) => {
            const active = jobFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setJobFilter(filter.key)}
                className={`rounded-full border px-3 py-2 text-xs font-black transition ${active ? "border-accent bg-accent text-black" : "border-white/10 bg-black/20 text-muted hover:border-white/25 hover:text-white"}`}
              >
                {filter.label} <span className="ml-1 font-mono opacity-70">{jobFilterCounts[filter.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {visibleJobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-white/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{formatJobType(job.type)}</h3>
                  <p className="mt-1 truncate font-mono text-[0.7rem] text-muted">{job.id}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${statusClass(job.status)}`}>{job.status}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${job.status === "failed" ? "bg-red-300" : "bg-accent"}`} style={{ width: `${job.progress}%` }} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{friendlyJobMessage(job)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => void handleJobDetail(job)} disabled={!savedToken} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-100 transition hover:bg-white hover:text-black disabled:opacity-40">
                  Detail
                </button>
                {isRetryableJob(job) ? (
                  <button onClick={() => void handleJobRetry(job)} disabled={!savedToken || busy} className="rounded-xl border border-red-200/35 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-200 hover:text-black disabled:opacity-40">
                    {job.type === "source_sync" ? "Retry sync" : "Retry import"}
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>Updated {formatDate(job.updatedAt)}</span>
                {job.completedAt ? <span>Done {formatDate(job.completedAt)}</span> : null}
              </div>
            </article>
          ))}
          {visibleJobs.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted">{emptyJobMessage}</p> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-sky-300/20 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_36%),rgba(56,189,248,0.06)] p-4 shadow-xl shadow-sky-950/20 sm:rounded-[2rem] sm:p-5">
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
        <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="rounded-3xl border border-lime-300/20 bg-lime-300/[0.06] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-lime-200">Available extensions</p>
                <h3 className="mt-1 font-black">Install source dari catalog</h3>
                <p className="mt-1 text-xs text-muted">Pilih source seperti extension repo Mihon. Setelah install, source masuk ke dropdown search/import.</p>
              </div>
              <button onClick={() => void loadAvailableSources()} disabled={!savedToken || busy} className="rounded-full border border-lime-200/30 px-3 py-2 text-xs font-black text-lime-100 transition hover:bg-lime-200 hover:text-black disabled:opacity-40">
                Refresh catalog
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {availableSources.map((extension) => {
                const installed = installedSourceIDs.has(extension.id);
                return (
                  <article key={extension.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate font-black">{extension.name}</h4>
                        <p className="mt-1 font-mono text-[0.65rem] text-muted">{extension.id} · {extension.language || "unknown"} · v{extension.version || "?"}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${installed ? "bg-lime-300/15 text-lime-200 ring-lime-300/20" : "bg-sky-200/15 text-sky-100 ring-sky-200/20"}`}>
                        {installed ? "Installed" : "Available"}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-muted">{extension.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted">
                      {extension.author ? <span className="rounded-full bg-white/10 px-2 py-1">{extension.author}</span> : null}
                      <span className="rounded-full bg-white/10 px-2 py-1">{extension.kind}</span>
                      {extension.homepage ? <span className="rounded-full bg-white/10 px-2 py-1">Repo source</span> : null}
                    </div>
                    <p className="mt-3 truncate font-mono text-[0.65rem] text-muted">{extension.baseUrl}</p>
                    {extension.capabilities.length ? <p className="mt-3 text-xs text-muted">Capabilities: {extension.capabilities.join(", ")}</p> : null}
                    <button type="button" onClick={() => void handleSourceInstall(extension.id)} disabled={!savedToken || busy || installed} className="mt-4 rounded-xl bg-lime-200 px-4 py-2 text-xs font-black text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">
                      {installed ? "Installed" : "Install"}
                    </button>
                  </article>
                );
              })}
              {availableSources.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted">Catalog belum loaded. Login atau klik refresh catalog.</p> : null}
            </div>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-sky-200">Source availability</p>
              <h3 className="mt-1 font-black">Registered adapters</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void loadSourceStatuses()} disabled={!savedToken || busy || sources.length === 0} className="rounded-full border border-sky-200/25 px-3 py-1 text-xs font-bold text-sky-100 transition hover:bg-sky-200 hover:text-black disabled:opacity-40">
                Refresh status
              </button>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-muted">{sources.length} loaded</span>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => {
              const active = activeSourceId === source.id;
              const enabled = sourceEnabled(source);
              const status = sourceStatuses[source.id];
              return (
                <article
                  key={source.id}
                  className={`rounded-2xl border p-3 text-left transition ${active ? "border-sky-200/50 bg-sky-200/15 text-sky-50" : "border-white/10 bg-white/[0.03] text-zinc-100"} ${enabled ? "" : "opacity-75"}`}
                >
                  <button type="button" onClick={() => setActiveSourceId(source.id)} disabled={!savedToken || busy || !enabled} className="block w-full text-left disabled:cursor-not-allowed">
                    <span className="block font-bold">{source.name}</span>
                    <span className="mt-1 block font-mono text-[0.65rem] text-muted">{source.id}</span>
                    {source.baseUrl ? <span className="mt-1 block truncate font-mono text-[0.65rem] text-muted">{source.baseUrl}</span> : null}
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${active ? "bg-sky-200 text-black ring-sky-100/50" : enabled ? "bg-lime-300/15 text-lime-200 ring-lime-300/20" : "bg-zinc-200/10 text-zinc-300 ring-white/10"}`}>
                      {active ? "Selected" : enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${sourceHealthClass(status)}`}>
                      {sourceHealthLabel(source, status)}
                    </span>
                    {source.kind ? <span className="inline-flex rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted">{source.kind}</span> : null}
                  </div>
                  {status?.message ? <p className="mt-3 line-clamp-2 text-xs text-muted">{status.message}</p> : null}
                  {source.lastError ? <p className="mt-3 line-clamp-2 text-xs text-red-100">{source.lastError}</p> : null}
                  {source.capabilities?.length ? <p className="mt-3 text-xs text-muted">Capabilities: {source.capabilities.join(", ")}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleSourceStatusRefresh(source.id)} disabled={!savedToken || busy} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-100 transition hover:bg-white hover:text-black disabled:opacity-40">
                      Check
                    </button>
                    <button type="button" onClick={() => void handleSourceToggle(source)} disabled={!savedToken || busy} className={`rounded-xl border px-3 py-2 text-xs font-black transition disabled:opacity-40 ${enabled ? "border-amber-200/35 text-amber-100 hover:bg-amber-200 hover:text-black" : "border-lime-200/35 text-lime-100 hover:bg-lime-200 hover:text-black"}`}>
                      {enabled ? "Disable" : "Enable"}
                    </button>
                    {source.kind === "json-http" ? (
                      <button type="button" onClick={() => setSourceForm(extensionFormFromSource(source))} disabled={!savedToken || busy} className="rounded-xl border border-sky-200/30 px-3 py-2 text-xs font-black text-sky-100 transition hover:bg-sky-200 hover:text-black disabled:opacity-40">
                        Edit
                      </button>
                    ) : null}
                    {source.kind === "json-http" ? (
                      <button type="button" onClick={() => void handleSourceDelete(source)} disabled={!savedToken || busy} className="rounded-xl border border-red-200/35 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-200 hover:text-black disabled:opacity-40">
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {sources.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted">Source belum loaded. Login dulu atau cek API/scraper stack.</p> : null}
          </div>
          <form onSubmit={handleSourceExtensionSubmit} className="mt-4 rounded-3xl border border-sky-200/15 bg-sky-200/[0.05] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-sky-200">JSON HTTP extension</p>
                <h3 className="mt-1 font-black">{sourceForm.editingID ? "Edit source" : "Add source"}</h3>
                <p className="mt-1 text-xs text-muted">Tambah adapter kompatibel JSON HTTP tanpa restart API. Header rahasia jangan ditempel di chat/log.</p>
              </div>
              {sourceForm.editingID ? (
                <button type="button" onClick={() => setSourceForm(emptyExtensionForm())} className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-muted transition hover:bg-white hover:text-black">
                  Cancel edit
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_2fr]">
              <label className="text-xs font-bold text-muted">
                Source ID
                <input
                  value={sourceForm.id}
                  onChange={(event) => setSourceForm((current) => ({ ...current, id: event.target.value }))}
                  disabled={!savedToken || busy || Boolean(sourceForm.editingID)}
                  placeholder="my-source"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-200 disabled:opacity-50"
                />
              </label>
              <label className="text-xs font-bold text-muted">
                Name
                <input
                  value={sourceForm.name}
                  onChange={(event) => setSourceForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={!savedToken || busy}
                  placeholder="My Source"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-200 disabled:opacity-50"
                />
              </label>
              <label className="text-xs font-bold text-muted">
                Base URL
                <input
                  value={sourceForm.baseUrl}
                  onChange={(event) => setSourceForm((current) => ({ ...current, baseUrl: event.target.value }))}
                  disabled={!savedToken || busy}
                  placeholder="http://localhost:19190"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-200 disabled:opacity-50"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold text-muted">
              Optional headers JSON
              <textarea
                value={sourceForm.headersJSON}
                onChange={(event) => setSourceForm((current) => ({ ...current, headersJSON: event.target.value }))}
                disabled={!savedToken || busy}
                rows={3}
                spellCheck={false}
                placeholder='{"X-Api-Key":"[REDACTED]"}'
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-xs text-white outline-none transition focus:border-sky-200 disabled:opacity-50"
              />
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-zinc-200">
                <input type="checkbox" checked={sourceForm.enabled} onChange={(event) => setSourceForm((current) => ({ ...current, enabled: event.target.checked }))} disabled={!savedToken || busy} className="h-4 w-4 accent-sky-200" />
                Enabled after save
              </label>
              <button disabled={!savedToken || busy || !sourceForm.name || !sourceForm.baseUrl || (!sourceForm.editingID && !sourceForm.id)} className="rounded-2xl bg-sky-200 px-5 py-3 text-sm font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
                {sourceForm.editingID ? "Update source" : "Add source"}
              </button>
            </div>
          </form>
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted">Quick query presets for {activeSourceName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeSourcePresets.map((preset) => (
                <button
                  key={`${activeSourceId || "fallback"}-${preset}`}
                  type="button"
                  onClick={() => setSourceQuery(preset)}
                  disabled={!savedToken || busy}
                  className="rounded-full border border-sky-200/25 bg-sky-200/10 px-3 py-2 text-xs font-black text-sky-100 transition hover:bg-sky-200 hover:text-black disabled:opacity-40"
                >
                  {preset}
                </button>
              ))}
            </div>
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
              <option key={item.id} value={item.id} disabled={!sourceEnabled(item)}>
                {item.name}{sourceEnabled(item) ? "" : " (disabled)"}
              </option>
            ))}
          </select>
          <input
            value={sourceQuery}
            onChange={(event) => setSourceQuery(event.target.value)}
            placeholder="Cari judul dari source"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-200"
          />
          <button disabled={!savedToken || busy || !sourceEnabled(sources.find((item) => item.id === activeSourceId) ?? {})} className="rounded-2xl bg-sky-200 px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
            Search source
          </button>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sourceResults.map((result) => (
            <article key={`${result.sourceId}-${result.id}`} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-sky-200/30 sm:flex-row sm:items-center">
              {/* Source covers can come from arbitrary scraper domains, so keep raw img instead of Next Image config sprawl. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.coverUrl} alt="" width={56} height={80} className="h-20 w-14 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">{result.title}</h3>
                <p className="mt-1 truncate text-xs text-muted">{result.sourceId} / {result.id}</p>
                <p className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-sky-100">Ready to preview</p>
              </div>
              <button onClick={() => void handleSourcePreview(result)} disabled={!savedToken || busy} className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-black transition hover:bg-sky-200 disabled:opacity-50 sm:w-auto">
                Preview
              </button>
            </article>
          ))}
        </div>
        {sourcePreview ? (
          <article id="source-preview-card" className="mt-5 grid min-w-0 gap-4 rounded-2xl border border-white/10 bg-black/25 p-3 shadow-xl shadow-black/20 sm:rounded-3xl sm:p-4 md:grid-cols-[96px_minmax(0,1fr)] xl:grid-cols-[96px_minmax(0,1fr)_320px]">
            {/* Source preview covers use the same arbitrary remote domains as search results. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sourcePreview.coverUrl} alt="" width={96} height={136} className="h-[136px] w-24 rounded-2xl object-cover" />
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-sky-200">Preview loaded</p>
              <h3 className="mt-1 break-words text-xl font-black sm:text-2xl">{sourcePreview.title}</h3>
              <p className="mt-2 line-clamp-4 text-sm text-muted sm:line-clamp-none">{sourcePreview.synopsis}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted">
                <span className="rounded-full bg-white/10 px-2 py-1">{sourcePreview.chapterCount} chapters</span>
                <span className="rounded-full bg-white/10 px-2 py-1">{sourcePreview.status}</span>
                <span className="rounded-full bg-white/10 px-2 py-1">{sourcePreview.type}</span>
              </div>
              <p className="mt-3 break-words text-xs text-muted">{sourcePreview.genres.join(", ")}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.06] p-4 md:col-span-2 xl:col-span-1">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-sky-200">Import safety</p>
              <div className="mt-3 grid gap-2 min-[380px]:grid-cols-2">
                {importPresets.map((preset) => {
                  const isActive = activeImportPreset?.key === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyImportPreset(preset)}
                      className={`rounded-2xl border px-3 py-2 text-left transition ${
                        isActive ? "border-sky-200 bg-sky-200 text-black" : "border-white/10 bg-black/20 text-sky-50 hover:border-sky-200/50"
                      }`}
                    >
                      <span className="block text-xs font-black">{preset.label}</span>
                      <span className={`mt-1 block text-[0.65rem] leading-snug ${isActive ? "text-black/65" : "text-muted"}`}>{preset.description}</span>
                    </button>
                  );
                })}
              </div>
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
                Cache cover/pages locally
              </label>
              {sourceNeedsLimit ? <p className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-xs font-semibold text-amber-100">Seri ini besar. Isi chapter limit atau aktifkan metadata-only supaya import tidak terlalu lama.</p> : null}
              <button onClick={() => void handleSourceImport(sourcePreview)} disabled={!savedToken || busy || sourceNeedsLimit} className="mt-4 w-full rounded-2xl bg-accent px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Importing..." : "Queue import"}
              </button>
              <p className="mt-2 text-xs text-muted">Setelah selesai, success panel akan muncul di Current job dengan link ke series dan latest chapter.</p>
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
          <div className="mt-4 rounded-2xl border border-sky-200/15 bg-sky-200/[0.06] p-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-sky-200">Safe sync mode</p>
            <label className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted">
              <input type="checkbox" checked={syncMetadataOnly} onChange={(event) => setSyncMetadataOnly(event.target.checked)} className="h-4 w-4 accent-sky-200" />
              Metadata/cover only
            </label>
            <label className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted">
              <input type="checkbox" checked={syncCachePages} onChange={(event) => setSyncCachePages(event.target.checked)} disabled={syncMetadataOnly} className="h-4 w-4 accent-sky-200 disabled:opacity-40" />
              Cache pages when syncing chapters
            </label>
            <label className="mt-3 block text-xs font-semibold text-muted">
              Chapter limit for chapter sync
              <input
                value={syncChapterLimit}
                onChange={(event) => setSyncChapterLimit(event.target.value)}
                disabled={syncMetadataOnly}
                type="number"
                min="0"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-200 disabled:opacity-40"
              />
            </label>
            <p className="mt-2 text-xs text-muted">Default aman buat refresh metadata dan cover cache tanpa narik pages besar.</p>
          </div>
          <div className="mt-4 grid gap-3">
            {series.map((item) => {
              const status = coverStatus(item.coverUrl);
              const statusMeta = coverStatusMeta(status);
              const latestIsPartial = Boolean(item.latestChapter && item.latestChapter.pageCount === 0);
              return (
                <article key={item.slug} className={`rounded-2xl border p-4 transition ${selectedSlug === item.slug ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                  <button onClick={() => setSelectedSlug(item.slug)} className="block w-full text-left">
                    <span className="block font-bold">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted">{item.slug} · {item.chapterCount} chapters</span>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] ring-1 ${statusMeta.className}`}>{statusMeta.label}</span>
                    <span className="mt-1 block text-xs text-muted">{statusMeta.hint}</span>
                    {latestIsPartial ? (
                      <span className="mt-2 block rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100">
                        Latest chapter metadata exists, tapi pages masih 0. Sync chapter pages atau upload page URLs/CBZ.
                      </span>
                    ) : null}
                    {item.sourceId ? <span className="mt-2 inline-flex rounded-full bg-sky-200/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-200">{item.sourceId}</span> : null}
                  </button>
                  {item.sourceId ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => void handleSeriesSync(item.slug)} disabled={!savedToken || busy} className="rounded-xl border border-sky-200/30 px-3 py-2 text-xs font-black text-sky-100 transition hover:bg-sky-200 hover:text-black disabled:opacity-40">
                        Sync
                      </button>
                      {status === "upstream" ? (
                        <button onClick={() => void handleCoverSync(item.slug)} disabled={!savedToken || busy} className="rounded-xl border border-amber-200/30 px-3 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-200 hover:text-black disabled:opacity-40">
                          Sync cover
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
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

      <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[min(24rem,calc(100vw-2rem))]">
        {toasts.map((toast) => (
          <article key={toast.id} className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${toastClass(toast.tone)}`} role="status">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{toast.title}</p>
                <p className="mt-1 text-sm opacity-80">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                className="rounded-full border border-white/10 px-2 py-1 text-xs font-black opacity-70 transition hover:opacity-100"
                aria-label="Close notification"
              >
                x
              </button>
            </div>
          </article>
        ))}
      </div>

      {selectedJob ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Admin job detail">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Close job detail" onClick={() => setSelectedJob(null)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-zinc-950 shadow-2xl shadow-black/50 sm:w-[34rem]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_38%),rgba(255,255,255,0.04)] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-sky-200">Job detail</p>
                  <h2 className="mt-2 truncate text-2xl font-black">{formatJobType(selectedJob.type)}</h2>
                  <p className="mt-1 truncate font-mono text-xs text-muted">{selectedJob.id}</p>
                </div>
                <button type="button" onClick={() => setSelectedJob(null)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-muted transition hover:bg-white hover:text-black">
                  Close
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ring-1 ${statusClass(selectedJob.status)}`}>{selectedJob.status}</span>
                <span className="font-mono text-sm text-muted">{selectedJob.progress}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${selectedJob.status === "failed" ? "bg-red-300" : "bg-sky-200"}`} style={{ width: `${selectedJob.progress}%` }} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <section className={`rounded-2xl border p-4 ${selectedJob.status === "failed" ? "border-red-300/25 bg-red-300/10 text-red-50" : "border-white/10 bg-white/[0.03]"}`}>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted">Summary</p>
                <p className="mt-2 text-sm font-semibold">{friendlyJobMessage(selectedJob)}</p>
                <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted">Raw message / error</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{selectedJob.message || "-"}</p>
              </section>

              <section className="mt-4 grid gap-3 sm:grid-cols-2">
                <JobMeta label="Created" value={formatDate(selectedJob.createdAt)} />
                <JobMeta label="Updated" value={formatDate(selectedJob.updatedAt)} />
                <JobMeta label="Completed" value={formatDate(selectedJob.completedAt)} />
                <JobMeta label="Retryable" value={isRetryableJob(selectedJob) ? "yes" : "no"} />
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-sky-200">Payload</p>
                    <h3 className="mt-1 font-black">Import identifiers</h3>
                  </div>
                  <button type="button" onClick={() => void handleJobDetail(selectedJob)} disabled={!savedToken} className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-muted transition hover:bg-white hover:text-black disabled:opacity-40">
                    Refresh
                  </button>
                </div>
                <div className="mt-4 grid gap-2">
                  {selectedJobPayload.map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">{key}</p>
                      <p className="mt-1 break-words font-mono text-xs text-zinc-100">{formatPayloadValue(value)}</p>
                    </div>
                  ))}
                  {selectedJobPayload.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-muted">Payload kosong.</p> : null}
                </div>
              </section>
            </div>

            <div className="border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
              {isRetryableJob(selectedJob) ? (
                <button type="button" onClick={() => void handleJobRetry(selectedJob)} disabled={!savedToken || busy} className="w-full rounded-2xl bg-red-200 px-4 py-3 font-black text-black transition hover:scale-[1.01] disabled:opacity-40">
                  {selectedJob.type === "source_sync" ? "Retry source sync" : "Retry source import"}
                </button>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted">Retry tersedia untuk failed source import atau source sync dengan payload lengkap.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function JobMeta({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-zinc-100">{value}</p>
    </article>
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
