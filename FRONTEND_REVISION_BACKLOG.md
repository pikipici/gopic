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

- [ ] Home composition second pass
  - Consider stronger featured hero using latest imported series.
  - Add source mix stats if useful.
- [ ] Catalog saved filters
  - Optional localStorage persistence for last used filters/sort.
- [ ] Series detail source attribution
  - Show imported source and external source URL if available and safe.
- [ ] Library empty state onboarding
  - Guide user to open catalog and read a chapter when no progress exists.
- [ ] Reader keyboard shortcuts
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

1. Pick one Priority 1 item.
2. Fix it in a small commit.
3. Run lint/build/tests relevant to the change.
4. Update this backlog by checking off or adding notes.
5. Repeat.
