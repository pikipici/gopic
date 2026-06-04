# Gomic Local AI Context

## Project

- Local path: `C:\Users\pikip\Documents\program\gomic`
- Frontend: `web/` Next.js App Router + TypeScript + Tailwind CSS.
- API: `api/` Go stdlib HTTP service + PostgreSQL support.
- Product target: manga/manhwa/manhua reader with admin import workflow.
- User preference: casual Indonesian/Jakarta style, concise status, direct action when saying `lanjut`.

## Current Milestone

- MVP import-to-reader flow is implemented and polished enough for iterative revision.
- Current active mode: backlog/revision tracking, not broad feature expansion.
- Revision backlog file: `FRONTEND_REVISION_BACKLOG.md`.
- Use that backlog to collect future fixes, then handle them gradually in focused commits.

## Current Working Stack / Ports

- Web/admin UI: `http://127.0.0.1:13000`
- API: `http://localhost:18190`
- KomikCast scraper: `http://localhost:19190`
- KomikIndo scraper: `http://localhost:19191`
- Admin token in local dev is configured through env; do not expose secrets in chat. Redact credentials as `[REDACTED]`.

## Dev Launcher

From repo root:

```bash
bash tools/dev_multisource.sh
```

The launcher starts/checks:

- KomikCast scraper on `19190`
- KomikIndo scraper on `19191`
- API on `18190` with `SOURCES_JSON`
- Web on `13000`

Important local web env:

- Web must be started with `NEXT_PUBLIC_API_BASE_URL=http://localhost:18190`.
- If web is started without that env, `web/src/lib/catalog.ts` falls back to `seriesSeed`, so API-imported titles like `elegant-spy-x-family` render as 404 on `/series/[slug]` even though the API has the data.
- If only restarting web manually, use:

```bash
env NEXT_PUBLIC_API_BASE_URL=http://localhost:18190 npm --prefix web run dev -- --hostname 127.0.0.1 --port 13000
```

## Implemented End-to-End Flow

- Admin `/admin`
  - login with admin token
  - source list
  - source search
  - preview metadata
  - queue source import
  - watch active job progress
  - job history
  - job history filter tabs for all/running/failed/completed jobs
  - job detail drawer with payload, timestamps, progress, final message/error, and retry actions
  - retry failed source import
  - retry failed source sync through safe sync defaults
  - safe source sync controls with metadata-only, chapter limit, and optional page caching
  - raw chapter/page/CBZ tools still available
- Public frontend
  - `/` home reads imported catalog/API data
  - `/series` catalog reads API data and supports filters/search/sort
  - `/series/[slug]` detail reads API data, handles partial chapters
  - `/series/[slug]/[chapterSlug]` reader reads imported pages and handles image loading/error/retry
  - `/library` uses API catalog plus localStorage reading progress
- Backend/import
  - PostgreSQL catalog schema is in place
  - multi-source registry supports KomikCast + KomikIndo + mock source
  - async source import jobs with statuses/progress
  - retry failed source import endpoint
  - image cache fallback preserves original remote URL when cache download fails

## Important Files

- Backlog: `FRONTEND_REVISION_BACKLOG.md`
- Web app root: `web/src/app/`
- Web catalog adapter: `web/src/lib/catalog.ts`
- Web types: `web/src/lib/types.ts`
- Admin UI: `web/src/app/admin/page.tsx`
- Catalog browser: `web/src/components/catalog-browser.tsx`
- Series card: `web/src/components/series-card.tsx`
- Chapter list: `web/src/components/chapter-list.tsx`
- Reader shell: `web/src/components/reader-shell.tsx`
- Library progress: `web/src/components/library-progress.tsx`
- API entrypoint: `api/cmd/api/main.go`
- API handlers: `api/internal/httpapi/handler.go`
- API config: `api/internal/config/config.go`
- Source import service: `api/internal/sourceimport/service.go`
- Image cache: `api/internal/imagecache/cache.go`
- Source scraper helper: `tools/source_service_scraper.py`
- Dev launcher: `tools/dev_multisource.sh`

## API Routes Of Interest

- `GET /healthz`
- `GET /api/v1/series`
- `GET /api/v1/series/{slug}`
- `GET /api/v1/series/{slug}/chapters/{chapterSlug}`
- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/sources/{sourceID}/search?q=...`
- `GET /api/v1/admin/sources/{sourceID}/series/{seriesID}`
- `POST /api/v1/admin/sources/{sourceID}/import`
- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/jobs/{jobID}`
- `POST /api/v1/admin/jobs/{jobID}/retry`
- `POST /api/v1/admin/series/{slug}/sync-source`

## Validation Baseline

Recent frontend final pass after `83aac7a`:

- `npm run lint && npm run build` succeeds from `web/`.
- Public/admin HTTP smoke checked:
  - `/` 200
  - `/series` 200
  - `/series/elegant-spy-x-family` 200 after web restart with correct API env
  - `/series/elegant-spy-x-family/elegant-spy-x-family-bahasa-indonesia` 200 after web restart with correct API env
  - `/library` 200
  - `/admin` 200

Recent backend/import validations performed during this milestone:

- Go tests passed for relevant packages during source/import/cache/retry work.
- KomikIndo import timeout issue was fixed by tolerating image cache download failures.
- Retry failed source import was tested successfully.

## Latest UI Polish Scope Completed

- Home polish
- Catalog polish
- Series card polish
- Series detail polish
- Chapter list polish
- Reader polish
- Library polish
- Mobile layout tightening
- Admin cockpit first polish pass
- Raw image usage documented and eslint warnings suppressed intentionally

## Latest Homepage Revision Progress

- Public home was revised toward a denser comic-index layout inspired by `comix.to`, using only real Gomic catalog/API/localStorage data.
- Latest active homepage revision replaced the earlier landing/hero-heavy composition with a denser comic-index dashboard:
  - compact top action strip
  - 3-column desktop shell
  - cover-led featured card
  - spotlight stack
  - hot update rows
  - catalog stats
  - genre chips
  - cover wall
  - full latest update feed
- Homepage visual direction now leans zinc/cyan dark app surfaces, closer to the detail/reader brief, instead of lime marketing-style surfaces.
- Latest Playwright-based homepage correction:
  - `comix.to` screenshots were captured to temp, but this model cannot inspect tool-returned images directly.
  - DOM/layout extraction showed the real homepage is not hero/dashboard-led; it is a dark comic index with announcement block and repeated horizontal poster rails.
  - Homepage was reworked again to match that structure more directly: announcement panel, fixed-width poster rails, rank overlay, chapter/time metadata, latest update poster grid, and compact discovery sidebar.
  - The previous big featured card/3-column dashboard approach was removed from `/`.
- Latest navbar revision toward `comix.to` reference:
  - `web/src/components/site-header.tsx` was revised from the previous compact Gomic header to a closer 64px `comix.to`-style top nav.
  - Header now uses dark `#22282a` surface, max `1400px` inner grid, fixed logo area, centered desktop search form, `Browse` chip inside search, right-side icon buttons, and a solid light `Admin` action as local replacement for login.
  - Mobile hides the full search form and keeps compact icon navigation.
  - Reader routes still hide the global header through `SiteHeaderShell`.
- Latest homepage validation after this revision:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
- Latest navbar validation after this revision:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
- Removed oversized home intro/banner copy so the page starts directly with catalog content.
- Removed `Source mix` and `Platform state` panels because they felt like admin/stat metadata rather than reader-facing homepage content.
- Home hero now uses a compact featured comic card with poster, metadata badges, synopsis, and primary read/detail actions.
- Mobile homepage layout was tightened:
  - hero is compact two-column on phones
  - horizontal rails are constrained with `max-w-full`
  - grid/flex children use `min-w-0` to avoid viewport overflow
  - poster rail items use `shrink-0` for predictable horizontal scrolling
- `Continue Reading` was changed from a single info card into a cover rail:
  - reads real localStorage progress via `getReadingProgress()`
  - hides entirely if there is no matching reading history
  - deduplicates by series and shows up to 8 records
  - each poster has a circular progress indicator
- Added a dedicated top `Trending` section under `Continue Reading`:
  - kicker: `Trending`
  - title: `Lagi rame dibaca`
  - horizontal poster rail from readable/trending catalog entries
- Existing lower `Trending` grid was renamed to `Popular Now` so it reads as the larger popular-title grid instead of duplicating the top rail.
- `Latest` remains the chapter-update section:
  - source data: `recentChapters`
  - cards link directly to chapter pages
- `Recently Added` is being replaced conceptually by `Try Random`:
  - kicker: `Try Random`
  - title: `Coba bacaan acak`
  - intended purpose is discovery, not another recency feed
  - implemented as `web/src/components/try-random-section.tsx`
  - client component with `Acak ulang` button
  - uses real catalog data only, preferring series with readable latest chapters and falling back to all series if needed

## Latest Public Source-Info Removal Progress

- User expectation: hide all source/scraper information from public frontend UI for now.
- Admin/import workflow should keep showing source information because it is operational/admin-only.
- Public source info removed from:
  - homepage hero badges
  - homepage `Latest` cards
  - homepage `Try Random` compact cards
  - `SeriesCard` badge overlays
  - catalog browser source filter
  - catalog page descriptive copy
  - library page descriptive copy
  - series detail source badge
  - series detail `Import Source` info panel
  - reader/chapter fallback copy that mentioned source
- Public copy was generalized away from `KomikCast`, `KomikIndo`, `Mock`, `Seed`, and `source` wording.
- Remaining `source`/`Seed` references in public route files are internal route/static-param names such as `getSeedStaticParams()` and are not visible UI.
- Remaining source UI in `web/src/app/admin/page.tsx` is intentional and should not be removed unless user explicitly says admin should hide it too.
- Latest validation after source-info removal:
  - `npm run lint && npm run build` passed from `web/`

## Latest Commit / Push

- Latest pushed commit: `83aac7a feat: refine public discovery UI`
- Pushed to `origin/main`.
- Commit includes:
  - public discovery UI refinements
  - `Try Random` client component with `Acak ulang`
  - public source/scraper wording removals
  - series detail layout cleanup
  - continue-reading/mobile overflow tweaks
  - `tools/dev_multisource.sh` stale port cleanup for web/API/scraper
- Working tree was clean immediately after push.

## Latest Reader / Detail UI Revision Progress

- Public series detail page was revised toward `ui_brief.md` / comix-style detail layout:
  - denser zinc/cyan visual direction
  - compact metadata/read actions
  - chapter list cleanup
  - recommendations/comments placeholder area
  - public `Partial`/import-debug style info removed from reader-facing UI
- Global public navigation was revised:
  - desktop `Home`, `Series`, and `Library` menu items were removed from `web/src/components/site-header.tsx`
  - mobile bottom nav items `Home`, `Series`, and `Library` were removed from `web/src/components/mobile-bottom-nav.tsx`
  - mobile bottom nav currently renders `null`
  - brand link and desktop `Browse` button remain
- Reader route immersion was improved:
  - added `web/src/components/site-header-shell.tsx`
  - global site header is hidden on reader routes
  - mobile bottom nav is hidden globally and therefore also absent on reader routes
- Reader shell was revised toward `ui_brief_reader_page.md`:
  - dark minimal canvas
  - fixed top reader bar
  - bottom floating toolbar
  - headless reading progress persistence via `web/src/components/reader-progress-tracker.tsx`
  - manual focus mode with `H` and double click/double tap center-page toggle
  - focus mode hides reader chrome until toggled again
- Reader gear/settings modal was revised toward `ui_brief_reader_gear_modal.md`:
  - modal overlay, not anchored popup
  - tabs for layout/image/shortcuts
  - persisted reader settings under `gomic:reader-settings:v2`
  - wired settings include zoom, strip margin, progress position, preload mode, direction, page layout, greyscale, and dim pages
- Reader layout button `⊞` was revised toward `ui_brief_reader_layout_panel.md`:
  - opens a right drawer only
  - drawer and gear modal mutually close
  - includes chapter selector, source/group area, layout cards, direction, metadata/follow, comments UI placeholder
  - follow is localStorage-only for now
  - comments/likes are frontend placeholder UI until backend/account APIs exist
- Dev launcher fix applied in `tools/dev_multisource.sh`:
  - empty port checks now tolerate normal no-process cases under Windows bash with `set -euo pipefail`

Latest validation after reader/detail/nav revisions:

- `npm run lint` passed from `web/`
- `npm run build` passed from `web/`
- Earlier reader route smoke for `/series/whats-wrong-with-being-the-villainess/94` returned `200`

Current known uncommitted work includes reader/detail/navigation revisions, local brief files, and the dev launcher fix. Do not commit/push unless explicitly requested.

## Latest Local Runtime Incident

- Symptom reported after push: imported manga detail pages and reader URL showed 404 in browser.
- Example URL: `http://127.0.0.1:13000/series/elegant-spy-x-family/elegant-spy-x-family-bahasa-indonesia`.
- Direct API check was valid:
  - `GET http://localhost:18190/api/v1/series/elegant-spy-x-family/chapters/elegant-spy-x-family-bahasa-indonesia` returned chapter data with 23 pages.
- `curl -L` of `/series/elegant-spy-x-family` revealed `NEXT_HTTP_ERROR_FALLBACK;404` from `SeriesDetailPage` while `/series` HTML showed only 4 seed titles (`nighthawk-protocol`, `saltwater-oracle`, etc.).
- Root cause: web dev server had been manually restarted without `NEXT_PUBLIC_API_BASE_URL`, so frontend catalog adapter fell back to `seriesSeed` and could not find imported API slugs.
- Fix applied: stopped stale web background process and restarted web with:

```bash
env NEXT_PUBLIC_API_BASE_URL=http://localhost:18190 npm --prefix web run dev -- --hostname 127.0.0.1 --port 13000
```

- Current web background process after fix: `bgp_e841ba9db001xu4zjhvOiEUciw`.
- Smoke after fix:
  - `/series` 200
  - `/series/elegant-spy-x-family` 200
  - `/series/elegant-spy-x-family/elegant-spy-x-family-bahasa-indonesia` 200

## Latest Import/Cache Reliability Progress

- Homepage follow-up issue after UI revert was not route/build related: `/` returned `200`, but several KomikCast covers used expired presigned MinIO/S3 URLs from `2026-05-31` with `X-Amz-Expires=86400`.
- Root cause: source import persisted source cover URLs directly; some covers are signed URLs that expire, so homepage/detail cover images can break days later.
- Backend fix added:
  - `api/internal/imagecache/cache.go` now has `CacheCover()` for remote cover URLs.
  - `api/internal/sourceimport/service.go` caches the series cover before `UpsertSeries` whenever image caching is enabled.
  - Cover cache failures are tolerated so import still completes, matching page-cache fallback behavior.
- Tests added in `api/internal/imagecache/cache_test.go` for remote cover caching and local cover passthrough.
- Admin copy updated in `web/src/app/admin/page.tsx`: cache option now says `Cache cover/pages locally`, and queued import labels say `cache images` / `upstream image URLs`.
- Existing DB rows with expired signed covers require API restart with the new code and source sync/import again via admin `Sync`/import to replace `coverUrl` with `/uploads/source-cache/...` URLs.
- Latest validation after reliability batch:
  - `go test ./...` passed from `api/`.
  - `npm run lint && npm run build` passed from `web/`.

## Latest Admin Import/Sync Reliability Progress

- Dev stack was restarted through `bash tools/dev_multisource.sh` so API/web used the latest source-cache and admin code.
- Cover-cache behavior was verified after restart; resynced imported titles now return local cached cover URLs like `/uploads/source-cache/.../cover/...webp` instead of expired signed upstream URLs.
- Admin job detail drawer was implemented in `web/src/app/admin/page.tsx`:
  - detail button on job cards
  - drawer shows job ID, type/status/progress, timestamps, final message/error, retryable state, and JSON payload
  - refresh action reloads the selected job through `GET /api/v1/admin/jobs/{jobID}`
  - failed `source_import` jobs can be retried from cards or drawer through the existing retry endpoint
- Granular safe source sync was implemented:
  - `POST /api/v1/admin/series/{slug}/sync-source` accepts optional JSON body fields `metadataOnly`, `chapterLimit`, and `cachePages`
  - `api/internal/sourceimport/service.go` adds `SyncSeriesWithOptions`
  - sync option parsing and tests were added in `api/internal/httpapi/handler.go` and `api/internal/httpapi/admin_test.go`
  - `metadataOnly` overrides page fetching/caching so effective payload records `cachePages:false`
  - admin UI exposes safe sync controls: metadata/cover only by default, optional page cache, and optional chapter limit
- Failed `source_sync` retry was implemented in admin UI:
  - retry uses the existing series sync endpoint instead of extending backend job retry
  - safe defaults are used on retry: `metadataOnly:true`, `cachePages:false`, preserving numeric `chapterLimit` if present
- Job History filter tabs were implemented:
  - filters: all, running, failed, completed
  - counts are shown per filter
  - empty-state copy changes by selected filter
- Admin cover cache status was implemented in `web/src/app/admin/page.tsx`:
  - imported series cards infer cover state from `coverUrl`
  - badges show `Cached cover`, `Upstream cover`, or `No cover`
  - upstream covers show a sync hint and `Sync cover` action
  - `Sync cover` queues safe metadata-only sync with `metadataOnly:true` and `cachePages:false`
- Admin source availability/preset panel was implemented in `web/src/app/admin/page.tsx`:
  - source adapter cards are rendered from `GET /api/v1/admin/sources`
  - cards show registered adapters as `Available` and active adapter as `Selected`
  - no fake backend health is shown because there is no source-health endpoint yet
  - quick query preset chips fill the search box for KomikCast, KomikIndo, mock source, or fallback sources
- Admin import safety presets were implemented in `web/src/app/admin/page.tsx`:
  - preview panel now has buttons for `Metadata only`, `1 chapter`, `2 chapters`, and `All chapters`
  - presets set the existing import options instead of adding backend behavior
  - metadata-only disables page caching through `cachePages:false`
  - all-chapters keeps the existing large-series guard when a preview has more than 100 chapters
- Better failed job copy was implemented in `web/src/app/admin/page.tsx`:
  - failed job cards and failure toasts show friendly summaries for timeout, API restart interruption, connection refused, DNS, auth, and not-found errors
  - job detail drawer preserves the raw backend job message/error under `Raw message / error`
  - non-failed jobs still show the original job message
- Partial chapter/page state improvements were implemented:
  - `web/src/components/chapter-list.tsx` labels zero-page chapters as `Partial import` instead of generic `No pages`
  - zero-page chapter rows explain that metadata exists but pages are missing and the chapter cannot open until pages are synced/imported
  - `web/src/app/series/[slug]/page.tsx` partial warning now includes the count of partial chapters and explains admin sync/upload recovery paths
  - `web/src/app/admin/page.tsx` series cards show a warning when the latest chapter has `pageCount = 0`
- Mobile visual QA tightening was implemented:
  - `web/src/app/admin/page.tsx` has smaller mobile page padding, hero text scale, tighter section radius/padding, safer source preview wrapping, import preset grid fallback below 380px, safe-area toasts, and safe-area job drawer footer padding
  - `web/src/components/reader-shell.tsx` prevents reader toolbar overflow by wrapping on small screens, makes double-page mode single-page on mobile, adds safe-area-aware horizontal hints, improves mobile layout drawer header wrapping, and sizes settings modal with `dvh`
- Latest admin reliability validation:
  - `go test ./...` passed from `api/`
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
  - smoke metadata-only sync jobs completed with payloads showing `cachePages:false` and `metadataOnly:true`
- Latest admin cover status validation:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
- Latest admin source panel validation:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
- Latest import safety preset validation:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
- Latest failed job copy validation:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
- Latest partial chapter/page state validation:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
  - `/series/nighthawk-protocol` smoke returned `200`
- Latest mobile visual QA validation:
  - `npm run lint` passed from `web/`
  - `npm run build` passed from `web/`
  - `/admin` smoke returned `200`
  - `/series/nighthawk-protocol/chapter-003` smoke returned `200`

## Current Next Action

## Latest Admin Extension Backend Progress

- 2026-06-03: Started backend foundation for admin-managed source/extension selection.
- Step 1 audit completed:
  - `api/internal/source/source.go` currently has a runtime-only `Registry` with `ID`, `Name`, `Search`, `Detail`, `ImportSeries`, and `Pages` behavior.
  - `api/internal/config/config.go` loads source adapters from env/runtime config via `SOURCES_JSON` and legacy `SOURCE_*` values.
  - `api/cmd/api/main.go` registers `mock` plus configured JSON HTTP sources at process startup only.
  - Existing admin source endpoints use the runtime registry directly and do not persist enabled state/config/capabilities.
  - PostgreSQL schema in `api/migrations/001_catalog_schema.sql` has catalog/job tables but no extension/source config table yet.
- Next implementation step: add a minimal persisted admin source/extension table and repository methods, seeded/synced from runtime registry without replacing existing import behavior yet.
- Step 2 persistence foundation completed:
  - Added `types.SourceExtension`, `SourceExtensionInput`, and `SourceExtensionPatch` in `api/internal/types/types.go`.
  - Added PostgreSQL table `admin_source_extensions` in `api/migrations/001_catalog_schema.sql` with enabled state, kind, base URL, capabilities, config JSON, last error, and timestamps.
  - Added `AdminStore` methods for listing, upserting, and patching source extensions.
  - Implemented in-memory repository support for seed/dev fallback and PostgreSQL support in `api/internal/catalog/postgres.go`.
  - `api/cmd/api/main.go` now syncs runtime registered sources (`mock-mihon` and configured JSON HTTP sources) into the persisted extension table at startup without changing existing search/import behavior yet.
  - Validation: `go test ./...` passed from `api/`.
- Next implementation step: expose admin API endpoints to list and patch persisted extensions, then wire existing source list response to include persisted state where appropriate.
- Step 3 admin extension API completed:
  - Added protected `GET /api/v1/admin/extensions` to list persisted source extensions.
  - Added protected `PATCH /api/v1/admin/extensions/{sourceID}` to update persisted `enabled` and `config` fields.
  - Updated `GET /api/v1/admin/sources` to return persisted source extension records when an admin repository is available, preserving fallback runtime registry summaries for seed-only mode.
  - Existing admin source `search`, `detail`, `import`, and failed import retry now reject disabled extensions with `409 source_disabled`.
  - Added HTTP API test coverage for extension list/patch and disabled-source search blocking.
  - Validation: `go test ./...` passed from `api/`.
  - Dev stack restarted with `bash tools/dev_multisource.sh`; smoke checks passed for API `/healthz` (`200`), web `/` (`200`), and unauthenticated `/api/v1/admin/extensions` correctly returned `401`.
- Step 4 source/extension health/status completed:
  - Added optional adapter health interface in `api/internal/source/source.go` via `HealthCheck`, `Status`, and `Registry.Status(ctx, id)`.
  - Added JSON HTTP source health probing in `api/internal/source/jsonhttp.go`, using `GET {baseURL}/healthz`.
  - Added mock source health support in `api/internal/source/mock.go`.
  - Added protected `GET /api/v1/admin/extensions/{sourceID}/status` in `api/internal/httpapi/handler.go`.
  - Added disabled-source blocking for `POST /api/v1/admin/series/{slug}/sync-source`, returning `409 source_disabled` when the series' persisted `sourceId` is disabled.
  - Added HTTP API tests for extension status and disabled-source sync blocking in `api/internal/httpapi/admin_test.go`.
  - Validation: `go test ./...` passed from `api/`.
  - Dev stack restarted with `bash tools/dev_multisource.sh` after killing stale web PID `27132`; smoke checks passed for API `/healthz` (`200`), web `/` (`200`), and unauthenticated `/api/v1/admin/extensions` correctly returned `401`.
- Step 5 admin UI extension integration completed:
  - `web/src/app/admin/page.tsx` now treats admin source records as persisted source extensions with optional `kind`, `baseUrl`, `enabled`, `capabilities`, `lastError`, and `updatedAt` fields.
  - Source cards show enabled/disabled state, selected state, kind, base URL, capabilities, last error, and real health status from `GET /api/v1/admin/extensions/{sourceID}/status`.
  - Added `Refresh status` and per-source `Check` actions for live health probes.
  - Added per-source `Enable` / `Disable` actions backed by `PATCH /api/v1/admin/extensions/{sourceID}`.
  - Search source select and source card selection now avoid disabled adapters, and source search/import guard disabled sources before calling backend operations.
  - Login flow now loads source statuses after loading persisted source records.
  - Validation: `npm run lint` passed from `web/`.
  - Validation: `npm run build` passed from `web/`.
  - Smoke: `curl -I --max-time 10 http://127.0.0.1:13000/admin` returned `200`.
- Step 6 authenticated extension smoke completed without exposing local admin token:
  - `GET /api/v1/admin/extensions` returned `200` with 3 extension records.
  - `GET /api/v1/admin/extensions/mock-mihon/status` returned `200`, healthy, and enabled.
  - `PATCH /api/v1/admin/extensions/mock-mihon` with `enabled:false` returned `200`.
  - Disabled `GET /api/v1/admin/sources/mock-mihon/search?q=neon` returned `409` with `source_disabled`.
  - Restored `mock-mihon` to original enabled state; follow-up status showed enabled again.
- Step 7 final cleanup/commit prep completed without committing:
  - Working tree audit showed 27 modified tracked files and 7 untracked files.
  - Extension milestone tracked files include backend extension persistence/API/status changes, `web/src/app/admin/page.tsx`, and `LOCAL_AI_CONTEXT.md`.
  - Existing broader uncommitted work is still mixed in the working tree, including frontend homepage/detail/reader/admin reliability files, `FRONTEND_REVISION_BACKLOG.md`, `tools/dev_multisource.sh`, and reader shell/navigation changes.
  - Untracked files remain present and were not deleted: `Comix - Read Comics online for free.html`, `Comix - Read Comics online for free_files/`, `ui_brief.md`, `ui_brief_reader_gear_modal.md`, `ui_brief_reader_layout_panel.md`, `ui_brief_reader_page.md`, and `web/src/components/site-header-shell.tsx`.
  - No cleanup deletion/revert was performed because those files may belong to prior work and should not be touched without explicit instruction.
  - Final validation passed: `go test ./...` from `api/`.
  - Final validation passed: `npm run lint` from `web/`.
  - Final validation passed: `npm run build` from `web/`.
- Step 8 backend-only extension commit completed:
  - User selected extension-only scope first, then backend-only because `web/src/app/admin/page.tsx` contains extension UI changes mixed with older admin reliability/mobile changes.
  - Staged and committed only backend extension files: `api/cmd/api/main.go`, `api/internal/catalog/admin.go`, `api/internal/catalog/postgres.go`, `api/internal/catalog/repository.go`, `api/internal/httpapi/admin_test.go`, `api/internal/httpapi/handler.go`, `api/internal/source/jsonhttp.go`, `api/internal/source/mock.go`, `api/internal/source/source.go`, `api/internal/types/types.go`, and `api/migrations/001_catalog_schema.sql`.
  - Pre-commit validation: `go test ./...` passed from `api/`.
  - Created commit `79f2ea8 feat: add admin source extension backend`.
  - No push was performed.
  - Remaining uncommitted work still includes `web/src/app/admin/page.tsx` extension UI integration plus older frontend/reliability changes and untracked brief/artifact files.
- Step 9 broader frontend/admin reliability commit completed:
  - User approved recommended broader frontend/admin UI commit because mixed admin UI changes were thematically aligned with backend source/admin reliability work.
  - Staged and committed remaining tracked frontend/reliability changes, excluding all untracked screenshot/brief artifacts.
  - Commit created: `5efffcd feat: improve admin source reliability UI`.
  - Pre-commit validation passed: `go test ./...` from `api/`, `npm run lint` from `web/`, and `npm run build` from `web/`.
  - No push was performed.
  - Remaining working tree after commit had only untracked local artifacts: `Comix - Read Comics online for free.html`, `Comix - Read Comics online for free_files/`, `ui_brief.md`, `ui_brief_reader_gear_modal.md`, `ui_brief_reader_layout_panel.md`, `ui_brief_reader_page.md`, and `web/src/components/site-header-shell.tsx`.
- Step 10 push and service restart completed:
  - User requested push and Gomic service restart.
  - Pushed `main` to `origin/main`, including commits `79f2ea8` and `5efffcd`.
  - Restart attempt found stale web listener on port `13000` with PID `33184`; killed PID `33184`.
  - Started fresh dev stack with `bash tools/dev_multisource.sh`.
  - New current background process: `bgp_e8ccac803001F37K3w0GiuQI4W`.
  - Smoke after restart passed: API `/healthz` returned `200`, web `/` returned `200`, and `/admin` returned `200`.
  - Branch status after push: `main...origin/main` with no ahead commits.
  - Remaining working tree only has untracked local artifacts listed above; no tracked changes except this context update if not committed.
- Current background process after restart: `bgp_e8ccac803001F37K3w0GiuQI4W`.
- Step 11 fresh-session plan prepared for backend-first dynamic extension/source management:
  - User wants the previously missing capabilities: add/install/manage source from extensions, edit config/base URL, remove source, and avoid requiring API restart for newly added JSON HTTP sources.
  - Next implementation should start from backend only; do not begin frontend UI form until backend APIs/tests are ready.
  - Backend target: support admin-managed JSON HTTP extensions dynamically from persisted records, while keeping arbitrary plugin/binary extension loading out of scope for now.
  - Add dynamic source registry support in `api/internal/source/source.go`: mutex-protected `Register(source.Source)`, `Unregister(id string)`, and optionally `Has(id string)` / safe `List`, `Get`, `Status` with `sync.RWMutex`.
  - Add/extend type validation for extension input: `id` required and slug-ish/lowercase safe, `name` required, `kind` currently only `json-http`, `baseUrl` required for `json-http`, and URL scheme must be `http` or `https`.
  - Add default capabilities for JSON HTTP sources when omitted: `search`, `detail`, `import`, `pages`, `health`.
  - Add `POST /api/v1/admin/extensions` to create/upsert a source extension from JSON body, persist it, register a runtime `source.JSONHTTPSource`, and return the persisted extension record.
  - Extend `PATCH /api/v1/admin/extensions/{sourceID}` beyond `enabled/config` so admin can edit `name`, `baseUrl`, optional capabilities/config, and re-register runtime source after changes.
  - Support optional headers from `config.headers` by extracting `map[string]string` and using `source.NewJSONHTTPSourceWithHeaders`; do not print secrets in chat/log summaries. Caveat: API currently returns admin-protected config raw unless masking is added.
  - Add `DELETE /api/v1/admin/extensions/{sourceID}` to remove source extension from persistence and unregister it from runtime. Existing imported series may still reference the old `sourceId`; sync for those should naturally fail/not find source after deletion.
  - Extend `catalog.AdminStore` with `GetSourceExtension(ctx,id)` and `DeleteSourceExtension(ctx,id)`; implement for in-memory repo and PostgreSQL.
  - Extend `types.SourceExtensionPatch` to include `Name`, `Kind`, `BaseURL`, and possibly `Capabilities` as pointer fields where omitted vs empty matters.
  - Add startup loading of persisted JSON HTTP extensions in `api/cmd/api/main.go` so admin-added sources survive API restart and are registered back into runtime registry.
  - Preserve user-disabled state when syncing env/runtime sources at startup; current upsert may overwrite enabled state, so add `GetSourceExtension` or list-before-upsert logic to keep existing `enabled` when source already exists.
  - Keep status endpoint registry-backed initially, but ensure `POST`, `PATCH`, and startup load register JSON HTTP sources so `GET /api/v1/admin/extensions/{sourceID}/status` works after creation/edit/restart.
  - Tests to add/extend in `api/internal/httpapi/admin_test.go`: create JSON HTTP extension using an `httptest.Server`, status works after create, patch name/baseUrl/enabled re-registers runtime source, disabled source blocks search with `409 source_disabled`, delete unregisters source and subsequent status/search returns `404`.
  - Consider repository-level tests if existing catalog test structure makes it easy.
  - Validation for this backend phase: `gofmt` changed Go files and `go test ./...` from `api/`.
  - Manual smoke after implementation: add extension via authenticated API with local token without exposing token, check status healthy, disable blocks search, enable restores search, restart dev stack, verify persisted source still appears/status works.
- Step 12 backend dynamic JSON HTTP extension implementation completed locally:
  - `api/internal/source/source.go` registry is now mutex-protected and supports runtime `Register` and `Unregister`.
  - `catalog.AdminStore` now includes `GetSourceExtension` and `DeleteSourceExtension`, implemented for in-memory and PostgreSQL repositories.
  - `types.SourceExtensionPatch` now supports optional `name`, `kind`, `baseUrl`, `enabled`, `capabilities`, and `config` updates.
  - Added protected `POST /api/v1/admin/extensions` to create/upsert persisted JSON HTTP extensions, validate input, apply default capabilities, and register them at runtime without API restart.
  - Extended protected `PATCH /api/v1/admin/extensions/{sourceID}` so JSON HTTP extensions can edit name/base URL/capabilities/config and re-register immediately; non-JSON built-ins keep enable/config-only behavior.
  - Added protected `DELETE /api/v1/admin/extensions/{sourceID}` to remove persisted extensions and unregister them from runtime.
  - Startup now preserves existing enabled state for env/runtime sources and registers persisted JSON HTTP extensions from the admin table after API restart.
  - Optional `config.headers` is extracted into JSON HTTP source headers; do not expose secret header values in chat.
  - Added `TestAdminDynamicJSONHTTPExtensionLifecycle` covering create/status/search, patch re-register, disabled search blocking, delete, and post-delete 404.
  - Validation passed: `gofmt` on changed Go files and `go test ./...` from `api/`.
  - Dev stack was restarted with backend latest code through `bash tools/dev_multisource.sh`; current background process is `bgp_e8cf7eab5001WOKCp11qfkP6Fs`.
  - Authenticated backend smoke passed without exposing token: create `smoke-json-http`, status check, search, disable causing expected `409`, re-enable/patch base URL, delete, and post-delete status `404`.
- Step 13 admin UI add/edit/delete extension controls completed locally:
  - `web/src/app/admin/page.tsx` now includes a JSON HTTP extension management form in the source availability panel.
  - Admin UI can create JSON HTTP sources with source ID, name, base URL, enabled state, and optional headers JSON.
  - Existing JSON HTTP source cards now have `Edit` and `Delete` actions; built-in/non-JSON sources keep enable/disable/status actions only.
  - Form submit calls `POST /api/v1/admin/extensions` for create and `PATCH /api/v1/admin/extensions/{sourceID}` for edit, then refreshes sources and status.
  - Delete action calls `DELETE /api/v1/admin/extensions/{sourceID}` after browser confirm and removes local status state.
  - Frontend validation passed: `npm run lint` and `npm run build` from `web/`.
  - Admin smoke passed: `curl -I --max-time 10 http://127.0.0.1:13000/admin` returned `200`.
  - Not yet committed/pushed.
- Remaining next admin extension step: optional browser manual UI click-through, then commit backend+frontend dynamic extension management; decide separately whether to keep, commit, or delete untracked local artifacts.

## Latest Batch: Keiyoushi Catalog Bridge + Scraper Framework

- Handoff update: 2026-06-04 WIB.
- All work committed and pushed: `32cb13b`, `ec90265`, `19323fe`, `ae3844a`, `b40bb7b`, `812ed09`.

### Keiyoushi Extension Catalog

- Backend reads `index.min.json` from `https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json` with 5-min in-memory cache.
- Config: `KEIYOUSHI_CATALOG_URL` env var, defaulting to the keiyoushi URL.
- `api/internal/httpapi/handler_catalog_keiyoushi.go` handles parsing keiyoushi format → `AvailableSourceExtension`.
- `mergeCatalogs()` merges keiyoushi + local `extension-catalog.json`, deduplicates, sorts by language then name.
- `api/adapter-map.json` defines which source IDs have actual working adapters. Runtime registry is also checked (`h.sources.Get(id)`).
- `SyncCatalogExtensions()` at startup auto-upserts all catalog entries to persisted table, preserving existing `enabled` state.
- `POST /api/v1/admin/extensions/catalog/sync` endpoint for manual re-sync without restart.
- Catalog currently returns ~2097 extensions (1461 keiyoushi entries flattened to per-source, plus local overrides).

### Admin UI Extension Panel

- Replaced separate "Available extensions" + "Source availability" panels with unified "Extension catalog" panel.
- Filter tabs: **Ready** (adapter available), **No adapter**, **All** with counts.
- Source cards show: name, ID, baseUrl, language, version, adapter status badge.
- Ready sources: enable/disable toggle, health check, edit/delete (json-http).
- No-adapter sources: dimmed, toggle disabled, "No adapter" badge.
- "Sync from catalog" button pulls new extensions without restart.

### Scraper Adapter Framework

- Modular Python structure in `tools/scrapers/`:
  - `__init__.py`: base `Scraper`, `Handler`, `SourceConfig`, `run_scraper()`
  - `__main__.py`: CLI entry point, `SOURCE_CONFIGS` dict, dynamic import
  - `templates/manga_themesia.py`: WordPress MangaThemesia theme parser
  - `templates/madara.py`: WordPress Madara theme parser
  - `sources/*.py`: per-source thin wrappers (5 lines each)
- New source = create file in `sources/` + import template + `create_scraper()`. Done.
- `_chapter_url()` fix in MangaThemesia: handles slugs that already contain chapter prefix (e.g., `akuyaku-reijou-tensei-oji-san-chapter-26`), not just bare chapter numbers.

### Running Scraper Sources (8 total, ports 19190-19205)

| ID | Name | Template | Status |
|---|---|---|---|
| `komikcast` | KomikCast | JSON API | ✅ Perfect — 12+ results, reliable import |
| `komikindo` | KomikIndo | MangaThemesia | ✅ Partial — search works, import works after `_chapter_url` fix |
| `mgkomik` | MGKomik | MangaThemesia | ❌ Blocked — HTTP 403 from upstream |
| `komiktap` | KomikTap | MangaThemesia | ✅ Partial — search works, import fixed by `_chapter_url` |
| `komikindoco` | KomikIndo.co | MangaThemesia | ⚠️ Search returns 0 — selector mismatch |
| `manhuascan` | ManhuaScan.us | Madara | ⚠️ Search returns 0 — selector mismatch |
| `manhwalover` | ManhwaLover | Madara | ⚠️ Search returns 0 — selector mismatch |
| `manhwax` | ManhwaX | Madara | ⚠️ Untested |

### Catalog / Import Status

- 24 series imported: KomikCast (10), KomikIndo (8), KomikTap (6).
- KomikCast uses JSON API → most reliable. MangaThemesia-based sources fixed by `_chapter_url` patch.
- Failed sources need per-site CSS selector tuning (search/HTML structure differs per WordPress theme even with same base template).

### Known Issues / Next Steps

- **WestManga** was tested but is React SPA (client-side JS render, `<div id="root">`), not scrapable with regex HTML.
- **MGKomik** was tested but returned HTTP 403, likely bot-protection.
- Remaining 4 Madara/MangaThemesia sources need debug with sample HTML → override search selectors.
- Commit/push only if explicitly requested.

## Notes / Caveats

- KomikIndo scraper has known edge cases where some chapter page URLs fail for certain slugs.
- Partial data is expected and should be handled gracefully in UI.
- Avoid exposing DB URLs/passwords/admin tokens. Use `[REDACTED]` in summaries.
- Raw `<img>` remains intentional for arbitrary scraper/cached image domains; do not switch to Next Image without deciding domain/image policy.
