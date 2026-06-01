# Gomic Revision Backlog

Status: parked backlog after MVP frontend/API/import flow is working and UI polish pass is complete.

Purpose: collect future revisions without fixing them immediately. Work items should be handled gradually, one focused batch at a time.

## Current Baseline

- Public frontend core flow is implemented end-to-end:
  - Admin import source -> catalog -> series detail -> reader -> library progress.
- UI polish pass is complete for:
  - Home
  - Catalog
  - Series cards
  - Series detail
  - Chapter list
  - Reader
  - Library
  - Admin cockpit first pass
- Multi-source import works for KomikCast and KomikIndo.
- Frontend lint/build is clean at the time this backlog was created.

## QA Findings

- [x] Fixed: frontend API fetch has a timeout so catalog pages do not load forever when the API stalls.
- [x] Fixed: continue-reading card no longer causes hydration mismatch when localStorage has progress.
- [x] Fixed: Postgres detail lookup closes rows before querying chapters, preventing detail/reader endpoint timeouts.
- [x] Fixed: reader handles imported chapters whose API payload omits `pages` by normalizing to an empty array and showing the partial-state UI.

## Implementation Prep - Gomic Public UI Refresh

Goal: evolve Gomic's public experience into a polished manga/manhwa discovery and reading platform using `comix.to` only as UI direction reference. Do not clone proprietary assets, branding, copy, exact layouts, CSS, or HTML.

Execution order:

1. Home discovery refresh.
2. Series detail refresh.
3. Reader refresh.
4. Mobile QA pass across home, detail, reader.
5. Small follow-up fixes only after the main flow is validated.

Implementation batches:

- Batch A - Home discovery shell
  - Status: completed in working tree.
  - Files likely touched: `web/src/app/page.tsx`, `web/src/components/series-card.tsx`, `web/src/lib/catalog.ts`, `web/src/lib/types.ts` only if existing data mapping needs small adjustments.
  - Keep it API-driven and avoid hardcoded fake catalog content.
  - Validate `/`, `/series`, and navigation into a detail page.
  - Completed notes:
    - Reworked `/` into a dark discovery dashboard with featured hero, hot updates, trending rail, source mix stats, genre shortcuts, platform state, and recently added titles.
    - Used existing Gomic API/catalog data only; no fake ratings, comments, follows, or community modules were added.
    - Touched `web/src/app/page.tsx` only.
    - Validation passed: `npm run lint`, `npm run build` from `web/`.
- Batch B - Series detail hub
  - Status: completed in working tree.
  - Files likely touched: `web/src/app/series/[slug]/page.tsx`, `web/src/components/chapter-list.tsx`, `web/src/lib/catalog.ts`, `web/src/lib/types.ts` only if required by existing API shape.
  - Prioritize read CTAs, chapter availability, partial-state clarity, and source/import attribution.
  - Validate `/series/[slug]` with complete and partial imported chapters.
  - Completed notes:
    - Reworked `/series/[slug]` into a detail hub with cover-led hero, start/latest/catalog CTAs, real stats strip, synopsis block, genre chips, source/import panel, chapter state panel, and credits panel.
    - Improved `ChapterList` with a resume/read action strip, denser touch-friendly chapter rows, clearer ready/partial/read/progress states, and no-pages rows kept non-clickable.
    - Used existing Gomic API/catalog data only; no fake follows, ratings, comments, recommendations, groups, or external links were added.
    - Touched `web/src/app/series/[slug]/page.tsx` and `web/src/components/chapter-list.tsx`.
    - Validation passed: `npm run lint`, `npm run build` from `web/`.
- Batch C - Reader mode
  - Status: completed in working tree.
  - Files likely touched: `web/src/app/series/[slug]/[chapterSlug]/page.tsx`, `web/src/components/reader-shell.tsx`, `web/src/components/library-progress.tsx` only if progress wiring needs verification.
  - Prioritize immersive reading canvas, prev/next/back navigation, image failure states, and localStorage progress preservation.
  - Validate `/series/[slug]/[chapterSlug]` with chapters that have pages and chapters with empty/missing pages.
  - Completed notes:
    - Reworked reader route to delegate full read-mode context into `ReaderShell`, including series/chapter labels, detail URL, previous chapter, and next chapter.
    - Reworked `ReaderShell` into a dedicated immersive reader with compact top context bar, reader settings strip, centered vertical image canvas, disabled-safe prev/next controls, and bottom end-of-chapter navigation.
    - Improved failed image recovery with retry, open image, and copy URL actions while keeping raw `<img>` usage intentional.
    - Reworked no-pages state into a full-screen partial import state with back/detail/admin and adjacent readable chapter actions.
    - Existing localStorage progress tracking remains wired through `ReaderProgressTracker`.
    - Touched `web/src/app/series/[slug]/[chapterSlug]/page.tsx` and `web/src/components/reader-shell.tsx`.
    - Validation passed: `npm run lint`, `npm run build` from `web/`.

Visual calibration follow-up:

- Status: completed in working tree after initial public UI refresh.
- Goal: move the first pass away from oversized landing-page styling and closer to a compact, metadata-dense comic discovery/index feel while still using original Gomic styling and real API data.
- Completed notes:
  - Tightened home hero, update rows/cards, recently added links, stats, section headers, and shared `SeriesCard` spacing/radius/typography.
  - Tightened series detail layout with smaller cover rail, compact hero shell, denser metadata chips/facts, compact source panels, and smaller chapter container.
  - Tightened `ChapterList` rows and resume strip with smaller radius, padding, badges, and row spacing while keeping touch targets usable.
  - Tightened reader chrome with slimmer sticky bars, compact nav/settings controls, smaller page frame radius, and less heavy end-of-chapter panel.
  - Continued avoiding fake ratings, ranks, comments, follows, recommendations, uploaders, groups, or unavailable metadata.
  - Touched `web/src/app/page.tsx`, `web/src/components/series-card.tsx`, `web/src/app/series/[slug]/page.tsx`, `web/src/components/chapter-list.tsx`, and `web/src/components/reader-shell.tsx`.

Shared visual direction:

- Dark, app-like comic platform mood.
- Discovery-first home, detail-as-content-hub, reader-as-dedicated-mode.
- Poster/cover art should lead visual hierarchy where available.
- Metadata should be compact and useful: source, status, chapter count, page count, updated/import state when real data exists.
- Mobile is first-class: check 360px, 390px, and 430px widths.
- Keep raw `<img>` usage unless an image/domain policy is explicitly decided.

Data rules:

- Use real Gomic API/catalog data only.
- Do not fake follows, ratings, ranks, comments, user recommendations, uploaders, scanlation groups, authors, artists, external links, or account/community state.
- If data is missing, show graceful empty/unknown states or omit the module.
- Preserve secret hygiene: never expose admin tokens, DB URLs, or credentials in UI copy, logs, or summaries.

Validation checklist per batch:

- Run `npm run lint` from `web/`.
- Run `npm run build` from `web/`.
- Smoke test desktop and mobile widths for touched routes.
- Verify API-down or sparse-catalog states remain graceful where the touched page already handles them.
- Verify navigation flow: home -> series detail -> reader -> library progress where relevant.

Commit slicing recommendation:

- One focused commit per batch when changes are meaningful and validated.
- Avoid mixing admin/import workflow changes into these public UI refresh commits.
- Update this backlog after each batch with completed items, caveats, and remaining follow-ups.

## Priority 1 - Practical UX / Reliability

- [ ] Admin job detail drawer/page
  - Show payload, source ID, series ID, progress, timestamps, and final error more clearly.
  - Keep secrets redacted.
- [ ] Admin retry UX improvement
  - Separate retry button from noisy job cards.
  - Show retry source/title if payload has enough metadata.
- [ ] Chapter/page partial state improvements
  - Mark imported chapters with `pageCount = 0` more explicitly in admin and public detail.
  - Add a clear "retry pages" concept later if backend supports it.
- [ ] Reader image fallback refinement
  - Add "open image in new tab" for failed pages.
  - Add copy URL button for failed image URLs.
- [ ] Mobile visual QA deeper pass
  - Test real phone widths around 360px, 390px, 430px.
  - Check admin cards, source preview, reader sticky controls, and bottom nav overlap.

## Priority 2 - Admin / Import Workflow

- [ ] Admin source search presets
  - Quick chips for KomikCast/KomikIndo sample queries.
- [ ] Import safety presets
  - Buttons for metadata only, 1 chapter, 2 chapters, all chapters.
- [ ] Source status panel
  - Health indicator per source adapter.
  - Show source URL/port in a redacted-safe way.
- [ ] Better failed job copy
  - Convert raw timeout/errors into friendlier messages.
  - Preserve raw error in expanded detail.
- [ ] Add cancel job support later
  - Requires backend support; do not fake it in UI.

## Priority 3 - Public Frontend Polish

- [ ] Home UI refresh inspired by `comix.to`
  - Use `comix.to` as the visual direction reference for the Gomic home page, without cloning assets, branding, copy, or exact CSS/HTML.
  - Reference findings from exploration:
    - `comix.to` behaves like a dark, app-like comic discovery dashboard rather than a generic marketing landing page.
    - The public HTML is mostly a SPA shell, but embedded data shows homepage feeds for trending titles, popular/most-followed titles, hot updates, recently added titles, recent comments, collections, and top uploaders.
    - The most useful transferable pattern is the composition: discovery-first hero/rail, dense update feed, secondary discovery/community modules, and compact metadata-heavy comic cards.
  - Desktop target:
    - Strong above-the-fold composition with a featured/trending area driven by imported series data.
    - Denser manga/comic discovery layout with clear visual hierarchy for cover, title, type/source/status, and chapter metadata.
    - Section rhythm similar to modern comic index pages: featured rail, hot/latest updates, popular/recommended grid, recently added, and compact metadata blocks.
    - Prefer a multi-column layout where the main column carries hero/updates and the side column carries source/import highlights or compact stats.
    - Preserve Gomic's existing routing and API-driven catalog behavior.
  - Mobile target:
    - Treat mobile as a first-class layout, not just a shrunken desktop.
    - Prioritize thumb-friendly horizontal rails, readable cards, tight metadata, and minimal vertical waste.
    - Convert desktop side modules into stacked compact cards below the primary discovery sections.
    - Keep hero copy short and avoid large synopsis blocks on small screens.
    - Ensure home navigation into series detail/reader remains obvious at 360px, 390px, and 430px widths.
  - Proposed home section order:
    - Discovery header/search entry with concise value copy and primary actions to catalog/admin.
    - Featured/trending area using imported series as the visual anchor.
    - Hot updates / fresh chapters using latest chapter/update metadata available from the current catalog model.
    - Popular/recommended rail approximated from available local data until real popularity/rating exists.
    - Recently added/imported grid.
    - Source mix/import highlights as a Gomic-specific replacement for `comix.to` community modules.
  - Implementation plan:
    - Inspect current home components and catalog adapter constraints.
    - Capture the reusable visual patterns from `comix.to`: dark discovery-dashboard mood, page density, card sizing, section ordering, spacing, poster-first cards, and responsive rail behavior.
    - Map current Gomic data into derived homepage groups:
      - featured/trending: first useful imported titles with covers and chapter data.
      - hot updates: titles with recent/latest chapter metadata.
      - recently added: catalog ordering fallback when timestamps are limited.
      - source highlights: counts/grouping by source/type/status if data exists.
    - Redesign `web/src/app/page.tsx` and any supporting presentational pieces with original styling using existing Tailwind/design conventions.
    - Add small reusable local helpers/components only if they keep the page readable; avoid broad design-system rewrites.
    - Reuse current API catalog data; avoid introducing hardcoded sample content except safe empty/loading states.
    - Do not add fake comments, collections, ratings, follows, uploaders, or community data until backend support exists.
    - Keep raw image handling policy unchanged because scraper/cached image domains are arbitrary.
    - Validate with `npm run lint`, `npm run build`, and manual desktop/mobile smoke on `/`.
  - Acceptance notes:
    - Home should feel closer to a polished comic discovery site than a generic landing page.
    - Desktop and mobile should both have intentional composition.
    - The redesign should improve perceived catalog activity even when data is partial.
    - Empty/loading/error states must remain graceful when the API is unavailable or catalog is sparse.
    - No proprietary `comix.to` assets, logos, exact copy, or pixel-perfect cloning.
- [ ] Series detail UI refresh inspired by `comix.to` title page
  - Use `https://comix.to/title/n8we-the-chick-class-hunter-is-filial` as the detail-page composition reference, without cloning assets, branding, exact copy, or CSS/HTML.
  - Reference findings from exploration:
    - The title page is a dark, app-like manga detail hub rendered from rich metadata in an SPA shell.
    - The embedded detail data includes poster, title, alternate titles, type, status, original language, year, latest chapter, first/latest chapter URLs, synopsis, rank, follows, rating, content rating, genres, formats, tags, authors, artists, external links, recommended titles, and scanlation groups.
    - The transferable UI pattern is a dense detail hub: cover-first hero, fast reading actions, compact facts, synopsis, chips/tags, chapter access, and related/source modules.
  - Desktop target:
    - Build a strong detail hero with poster art as the visual anchor and an ambient dark surface/gradient behind it.
    - Use a two-column or hero-plus-sidebar layout where the main column carries title, synopsis, and chapter list, while the side column carries compact facts/source/import info.
    - Make primary CTAs obvious above the fold: start reading, continue/latest chapter when available, and back to catalog.
    - Keep metadata dense but readable: source, status, chapter count, page/import completeness, type/language if available.
    - Keep the chapter list as the functional center of the page, not buried under decorative content.
  - Mobile target:
    - Treat mobile as a dedicated layout: compact poster/title hero, short metadata chips, visible read CTA, then chapters quickly.
    - Avoid letting long synopsis or large poster consume the entire first screen.
    - Use collapsible/clamped synopsis and compact chapter rows if needed.
    - Ensure chapter rows have comfortable touch targets around 360px, 390px, and 430px widths.
    - Move sidebar/source info below chapters or into compact stacked cards.
  - Proposed detail section order:
    - Poster/title hero with source/status/chapter metadata.
    - Primary reading actions: start first available chapter, latest available chapter, and catalog navigation.
    - Compact stats/facts strip using real Gomic data only.
    - Synopsis/description with graceful empty state.
    - Chapter list with clear partial/no-pages states.
    - Source/import information panel.
    - More from same source or recently imported titles as a non-fake replacement for `comix.to` recommendations.
  - Implementation plan:
    - Inspect current `web/src/app/series/[slug]/page.tsx`, `web/src/components/chapter-list.tsx`, `web/src/lib/catalog.ts`, and related types.
    - Map current Gomic data into detail UI groups:
      - hero: title, cover, description, source/type/status if present.
      - actions: first readable chapter, latest readable chapter, fallback disabled state when no chapters/pages exist.
      - facts: chapter count, total/known page count, imported source, partial chapter indicators if available.
      - chapters: chapter slug/title/order/page count and partial-state messaging.
      - related: same-source/recently imported titles if available from existing catalog data.
    - Redesign the detail page with original Tailwind styling that matches the dark discovery-dashboard direction planned for home.
    - Update or wrap `ChapterList` only as needed to improve density, mobile touch targets, and partial-state clarity.
    - Add small local helpers/components only if they reduce duplication; avoid broad design-system rewrites.
    - Reuse current API data and routes; do not introduce hardcoded manga metadata beyond safe empty/loading states.
    - Do not add fake follows, ratings, rank, comments, recommendations, external links, scanlation groups, authors, or artists unless the backend provides them.
    - Keep raw image handling policy unchanged because scraper/cached image domains are arbitrary.
    - Validate with `npm run lint`, `npm run build`, and manual desktop/mobile smoke on `/series/[slug]` plus navigation into a chapter.
  - Acceptance notes:
    - Detail page should feel like a polished manga detail hub, not a plain database detail page.
    - The first screen should clearly answer what the series is, where it came from, and how to start reading.
    - Chapter availability and partial imports must be obvious and graceful.
    - Desktop and mobile should both have intentional composition.
    - No proprietary `comix.to` assets, logos, exact copy, exact layout, or pixel-perfect cloning.
- [ ] Reader UI refresh inspired by `comix.to` read page
  - Use `https://comix.to/title/n8we-the-chick-class-hunter-is-filial/10051362-chapter-68` as the reader composition reference, without cloning assets, branding, exact copy, or CSS/HTML.
  - Reference findings from exploration:
    - The read page is a dedicated dark reading mode with `page: read` and a special `rpage-body` class, separate from normal detail/home pages.
    - Initial reader data is intentionally minimal: manga detail metadata plus read context containing manga ID/HID, chapter ID, and chapter number.
    - Chapter image/page data appears to be loaded client-side after hydration, so the UI must handle loading, partial, and failure states cleanly.
    - The transferable UI pattern is an immersive reader shell: low-distraction dark canvas, compact chapter controls, focused vertical image reading, and app-like mobile behavior.
  - Desktop target:
    - Use a dedicated immersive reader surface with a dark background and minimal page chrome.
    - Keep images centered with a comfortable max width for manhwa/webtoon vertical reading.
    - Provide compact sticky or near-sticky reader controls: back to series, series title, chapter label, previous/next chapter, and chapter selector/list shortcut if feasible.
    - Keep top controls visible enough for orientation but visually subdued so images remain the focus.
    - Add bottom chapter navigation after the last page so users can continue without scrolling back to the top.
  - Mobile target:
    - Treat mobile as the primary reader use case: full-width image canvas, minimal horizontal padding, and thumb-friendly controls.
    - Avoid large sticky bars that cover page images.
    - Keep back/prev/next controls reachable with compact top and/or bottom controls.
    - Preserve a smooth vertical scroll reading flow with minimal gaps between pages.
    - Ensure empty, partial, and failed-image states remain readable around 360px, 390px, and 430px widths.
  - Proposed reader section/order:
    - Compact reader top bar with back-to-series, title/chapter context, and chapter navigation.
    - Optional slim status row for source/page count/import state when it helps, not as noisy decoration.
    - Main vertical page canvas with loading and error handling per image.
    - No-pages/partial-import state when chapter payload has no usable pages.
    - Bottom navigation with previous chapter, back to detail, next chapter, and completion/progress context.
  - Implementation plan:
    - Inspect current `web/src/app/series/[slug]/[chapterSlug]/page.tsx`, `web/src/components/reader-shell.tsx`, `web/src/lib/catalog.ts`, `web/src/lib/types.ts`, and localStorage progress behavior used by `/library`.
    - Map current Gomic data into reader UI groups:
      - context: series title, series slug, chapter slug/title/order/source if available.
      - navigation: previous chapter, next chapter, back to detail, chapter list shortcut if available.
      - canvas: page image URLs, page index, page count, image loading/error state.
      - progress: existing localStorage reading progress, last read chapter/page, completion hint if available.
      - partial state: chapters with empty/missing `pages`, failed cached images, and original remote fallback URLs if available.
    - Redesign `ReaderShell` as the primary reader experience with original Tailwind styling that matches the dark app-like direction planned for home/detail.
    - Keep raw `<img>` usage intentional because scraper/cached image domains are arbitrary.
    - Improve per-image failure UI in the reader while coordinating with existing Priority 1 fallback refinement: retry, open image in new tab, and copy URL can be handled together if small enough.
    - Add keyboard shortcuts only if they fit cleanly; otherwise leave the existing `Reader keyboard shortcuts` backlog item separate.
    - Reuse current API data and routes; do not introduce fake reader settings, comments, ratings, follows, groups, or sync state.
    - Validate with `npm run lint`, `npm run build`, and manual desktop/mobile smoke on `/series/[slug]/[chapterSlug]` using chapters with pages and chapters with empty/partial pages.
  - Acceptance notes:
    - Reader should feel like a dedicated reading mode, not a normal content page with images appended.
    - Page images must remain the visual priority on both desktop and mobile.
    - Previous/next/back navigation must be obvious and safe when adjacent chapters are unavailable.
    - Loading, failed image, and no-pages states must be explicit and recoverable where possible.
    - Existing library/localStorage reading progress must continue working.
    - No proprietary `comix.to` assets, logos, exact copy, exact layout, or pixel-perfect cloning.
- [ ] Catalog saved filters
  - Optional localStorage persistence for last used filters/sort.
- [ ] Series detail source attribution
  - Fold this into the `Series detail UI refresh inspired by comix.to title page` work when possible.
  - Show imported source and external source URL if available and safe.
- [ ] Library empty state onboarding
  - Guide user to open catalog and read a chapter when no progress exists.
- [ ] Reader keyboard shortcuts
  - Consider folding this into the `Reader UI refresh inspired by comix.to read page` work only if the shell changes make it straightforward.
  - Next/previous chapter, top/bottom scroll, settings toggle.

## Priority 4 - Backend / Data Debt To Revisit

- [ ] KomikIndo scraper edge cases
  - Some chapter page URLs fail for certain slugs.
  - Do not block frontend work on this unless a chosen sample series needs it.
- [ ] Partial import state model
  - Add explicit chapter/page import status instead of relying only on job status and `pageCount`.
- [ ] Durable job worker
  - Current jobs are good for local MVP, but production needs stronger worker semantics.
- [ ] Cache cleanup policy
  - Add strategy for deleting stale cached images.
- [ ] Rate limiting / source throttling
  - Avoid hammering source sites during large imports.

## Priority 5 - Dev Workflow / Docs

- [ ] Update local docs around `tools/dev_multisource.sh`.
- [ ] Keep `LOCAL_AI_CONTEXT.md` current after major milestone changes.
- [ ] Add a short smoke checklist for manual QA:
  - start stack
  - import sample
  - open catalog
  - open detail
  - open reader
  - check library
- [ ] Consider screenshots or visual checklist later.

## Do Not Fix Now

- Do not rebuild auth/user accounts yet.
- Do not add cloud sync yet.
- Do not convert arbitrary scraper images to Next Image until image/domain policy is decided.
- Do not scrape huge libraries just to fill UI.
- Do not over-optimize admin UI before import reliability is stable.

## Suggested Working Order

1. For the Gomic public UI refresh, follow `Implementation Prep - Gomic Public UI Refresh` in batch order: Home, Series Detail, Reader, Mobile QA.
2. Keep each batch focused and avoid fixing unrelated admin/import backlog items unless they directly block the selected public UI batch.
3. Run lint/build/tests relevant to the touched area before marking a batch complete.
4. Update this backlog by checking off completed items or adding caveats/follow-ups.
5. After the public UI refresh is stable, return to Priority 1 reliability/admin items one focused commit at a time.
