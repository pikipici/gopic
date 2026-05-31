# Gomic — Ide Implementasi & Living Plan

> Status: v0.11 — PostgreSQL admin series write path added
> Owner: user + Hermes
> Last updated: 2026-05-30

## Daftar Isi
- [0. Locked Decisions](#0-locked-decisions-v04)
- [1. Goal](#1-goal)
- [2. Target Users](#2-target-users)
- [3. Tech Stack](#3-tech-stack)
- [4. Core Features (MVP)](#4-core-features-mvp)
- [5. User Flows](#5-user-flows)
- [6. Data Model](#6-data-model)
- [7. API Endpoints](#7-api-endpoints)
- [8. Routes / Screens](#8-routes--screens)
- [9. Project Structure](#9-project-structure)
- [10. Phasing / Roadmap](#10-phasing--roadmap)
- [11. Risks / Concerns](#11-risks--concerns)
- [12. Open Decisions Tersisa (v0.4)](#12-open-decisions-tersisa-v04)
- [13. Deploy Strategy](#13-deploy-strategy)
- [14. Frontend Development Arsenal](#14-frontend-development-arsenal)
- [15. Implementation Notes](#15-implementation-notes)
- [16. Current Next Step](#16-current-next-step)

## 0. Locked Decisions (v0.4)

| # | Keputusan | Pilihan |
|---|-----------|---------|
| 1 | Mode kerja awal | **Kumpulkan ide dulu di Markdown; belum implementasi kode app.** |
| 2 | Dokumen utama | **`PROJECT_IDEAS.md` jadi living plan sementara untuk ide, keputusan, dan fase.** |
| 3 | Nama kerja proyek | **Gomic** — asumsi dari nama folder saat ini, bisa diganti kalau domainnya beda. |
| 4 | Domain produk | **Platform online untuk membaca manga, manhwa, dan manhua.** |
| 5 | Prioritas eksplorasi | **Produk & reader experience dulu** sebelum stack/kode, karena reader adalah core value platform. |
| 6 | Reader MVP | **Mobile-first vertical scroll reader** dengan lazy load image, prev/next chapter, dan auto last-read. |
| 7 | Content entity internal | **Series** sebagai istilah internal netral; `Type` membedakan Manga / Manhwa / Manhua. |
| 8 | Discovery MVP | **Latest update + search + filter genre/type/status + detail page.** Trending/popular bisa fase lanjut. |
| 9 | Content workflow awal | **Admin-managed content**; user/author upload publik tidak masuk MVP. |
| 10 | Auth boundary MVP | **Admin login wajib; reader/user login ditunda.** Progress baca disimpan localStorage dulu. |
| 11 | Admin MVP | **CRUD series + CRUD chapter + manage/reorder page images + draft/publish.** |
| 12 | Legal/content boundary | **Plan harus eksplisit soal sumber konten dan risiko copyright** sebelum import/scrape/upload massal. |
| 13 | Referensi benchmark awal | **comix.to dipakai sebagai benchmark UX/pattern**, bukan copy aset/logo/CSS/content 1:1. |
| 14 | Reader mode v0.3 | **Vertical scroll only untuk MVP**; page-by-page ditunda supaya mobile reader cepat matang. |
| 15 | Reader chrome | **Header auto-hide saat scroll down, muncul saat scroll up/tap**; chrome tidak boleh menutup area baca terlalu banyak. |
| 16 | Reader progress indicator | **Thin top progress bar + page counter saat chrome tampil**; progress disimpan sebagai page index + scroll percent. |
| 17 | Image loading | **Lazy-load semua page image + preload 2-3 page berikutnya + skeleton gelap + retry per image.** |
| 18 | Local reading progress | **localStorage per series + recent history max 50 item**; siap dimigrasi ke akun user nanti. |
| 19 | Chapter navigation | **Chapter dropdown di header + big CTA Next Chapter di akhir chapter + Previous Chapter fallback.** |
| 20 | Reader settings MVP | **Theme dark/light, image width fit/capped, page gap compact/comfy.** Setting lain ditunda. |
| 21 | Mobile gesture MVP | **Tap untuk toggle chrome**; swipe next chapter ditunda agar tidak bentrok scroll. |
| 22 | Reader error handling | **Error card per image dengan retry**; empty/unpublished chapter punya state jelas dan link balik. |
| 23 | Homepage hierarchy reference | **Latest tetap MVP, tapi struktur siap untuk Hot/Trending/Recently Added** seperti pattern comix.to. |
| 24 | Metadata enrichment from reference | **Alt titles, content rating, demographic, author, artist** disiapkan di model/filter walau sebagian bisa hidden di MVP. |
| 25 | Frontend stack | **Next.js App Router + TypeScript** untuk SEO public pages, routing reader/detail, dan iterasi UI cepat. |
| 26 | Styling stack | **Tailwind CSS + custom public components**; shadcn/ui ditunda untuk admin/forms saat Fase 3. |
| 27 | Backend target | **Go API sebagai backend final** untuk catalog/admin/auth/upload/storage lifecycle. |
| 28 | Database target | **PostgreSQL saat backend Go masuk**; tidak wajib di Fase 1-2. |
| 29 | MVP data strategy | **Fase 1-2 pakai typed static seed data di repo** supaya reader/home/detail cepat divalidasi. |
| 30 | Backend phasing | **No real DB/backend dependency sampai Fase 3**; data layer dibuat replaceable agar migrasi ke Go API rapi. |
| 31 | Storage phasing | **Static placeholder/local public assets dulu**; object storage/CDN masuk Fase 4. |
| 32 | Local state strategy | **Custom typed localStorage helper** untuk reading progress; Zustand ditunda sampai state makin kompleks. |
| 33 | Fase 1 execution scope | **Scaffold Next.js baseline + theme tokens + seed data + public shell routes**, belum admin/Go API real. |

## 1. Goal

Membangun **Gomic** sebagai platform online untuk membaca manga, manhwa, dan manhua dengan pengalaman baca yang cepat, nyaman, dan mobile-first.

Goal MVP:
- User bisa menemukan series dari homepage/katalog.
- User bisa melihat detail series dan daftar chapter.
- User bisa membaca chapter dalam reader vertical scroll.
- Sistem menyimpan progres baca lokal di browser.
- Admin bisa mengelola series, chapter, dan page images.

## 2. Target Users

### 2.1 Reader publik
- Membaca manga/manhwa/manhua online.
- Mencari bacaan berdasarkan judul, genre, type, dan status.
- Melanjutkan bacaan terakhir tanpa harus login.

### 2.2 Admin konten
- Menambah/mengedit series.
- Menambah/mengedit chapter.
- Upload atau memasukkan page images.
- Preview lalu publish/unpublish konten.

### 2.3 Future roles (bukan MVP)
- Registered reader untuk bookmark/history sinkron antar device.
- Contributor/uploader.
- Moderator.
- Author resmi.

## 3. Tech Stack

Belum final, tapi rekomendasi awal:

### 3.1 Stack locked v0.4
- **Frontend:** Next.js App Router + TypeScript. (locked #25)
- **Styling:** Tailwind CSS + custom public UI components. (locked #26)
- **Admin UI later:** shadcn/ui untuk forms/table/dialog saat Fase 3, bukan dependency public reader awal. (locked #26)
- **Backend target:** Go API. (locked #27)
- **Database target:** PostgreSQL saat Go backend masuk. (locked #28)
- **MVP data source:** typed static seed data di repo untuk Fase 1-2. (locked #29)
- **Storage awal:** static placeholder/local public assets. (locked #31)
- **Storage target:** object storage/CDN saat Fase 4.

### 3.2 Phased architecture
- Fase 1-2 fokus public reader UX dengan Next.js + seed data.
- Fase 3 mulai Go API + PostgreSQL + admin auth/content CRUD.
- Fase 4 hardening upload/object storage/CDN/deploy.
- Data access di frontend tetap lewat module/repository internal agar gampang diganti dari seed data ke API client. (locked #30)

## 4. Core Features (MVP)

### 4.1 Reader experience
- Mobile-first vertical scroll reader. (locked #6, #14)
- Header auto-hide saat scroll down; muncul saat scroll up/tap. (locked #15)
- Thin top progress bar + page counter saat chrome tampil. (locked #16)
- Lazy-load chapter page images + preload 2-3 page berikutnya. (locked #17)
- Skeleton gelap untuk loading image.
- Error card per image dengan retry. (locked #22)
- Prev/next chapter navigation + chapter dropdown + end-of-chapter CTA. (locked #19)
- Auto-save last-read di localStorage per series. (locked #10, #18)
- Dark mode sebagai default kuat untuk pengalaman baca malam.
- Reader settings minimal: theme, image width, page gap. (locked #20)
- Tap mobile untuk toggle chrome; swipe next ditunda. (locked #21)

### 4.2 Content & detail
- Series sebagai entity utama. (locked #7)
- Type: Manga / Manhwa / Manhua.
- Metadata: title, alternative titles, slug, synopsis, cover, type, status, genres, author/artist, release year opsional.
- Metadata enrichment: content rating dan demographic disiapkan dari awal. (locked #24)
- Detail page dengan cover, synopsis, genre, status, chapter list, latest chapter.
- Chapter numbering harus fleksibel: `1`, `1.5`, `10.2`, `Special`, `Extra`.

### 4.3 Discovery / katalog
- Homepage latest update. (locked #8)
- Struktur homepage siap berkembang ke Hot/Trending/Recently Added seperti benchmark comix.to. (locked #13, #23)
- Search title dan alternative titles.
- Filter genre.
- Filter type: Manga / Manhwa / Manhua.
- Filter status: Ongoing / Completed / Hiatus / Dropped.
- Filter lanjutan nanti: content rating dan demographic. (locked #24)
- Katalog responsive dengan cards.

### 4.4 Admin content management
- Admin login. (locked #10)
- CRUD series. (locked #11)
- CRUD chapter. (locked #11)
- Upload/input page images per chapter.
- Reorder pages.
- Draft/publish series dan chapter.
- Preview reader sebelum publish.

### 4.5 Deferred / bukan MVP
- User login publik.
- Cloud bookmark/history sync.
- Go API + PostgreSQL real sebelum Fase 3.
- Comment/rating.
- Trending/popular real analytics.
- Scraper/import otomatis.
- Contributor/author upload.
- Payment/premium.
- Mobile app native.

### 4.6 Reference notes — comix.to
Recon pasif + visual capture 2026-05-30 menemukan pola yang relevan:
- Dark theme default.
- Homepage memakai beberapa bucket: trending, top/follows, hot/latest update, newly created, comments, collections, top uploaders.
- Content model memuat `title`, `altTitles`, `type`, `contentRating`, `status`, `year`.
- UI punya konsep card compact, add to library/bookmark, advanced filters, content rating, demographic, comments, collections, PWA/install.
- Visual homepage: dark charcoal/teal background, Geist/system font, sticky topnav, desktop content grid 960px + sidebar 340px, mobile gutter 16px, poster-dominant 2-column cards.
- Visual detail page: hero layout dengan poster kiri, CTA `Start reading`, follow/rating actions, breadcrumbs, genre chips, chapter list, recommendations.
- Visual reader page: long-strip reader dengan background hampir hitam, images full-width mobile / centered 640px desktop, segmented progress bar tipis di kiri, settings untuk reading direction, strip margin, progress bar, dan reader controls.

Yang kita adopsi untuk Gomic:
- Pattern dark-first, mobile-first, card-based discovery.
- Clean dark utilitarian direction: poster cover jadi warna utama, UI chrome low-noise.
- Metadata kaya: alt titles, content rating, demographic, author/artist.
- Homepage hierarchy siap Hot/Trending/Latest, tapi MVP tetap Latest + Search/Filter.
- Detail page memakai pola poster + CTA baca + metadata chips + chapter list.
- Reader memakai long-strip centered desktop dan full-width mobile, dengan progress bar tipis low-noise.
- Continue reading/currently reading lewat localStorage.

Yang tidak masuk MVP:
- Comments.
- Collections publik.
- Top uploaders.
- PWA/install.
- Social login/user account.
- Copy aset/logo/CSS/content comix.to.
- Iklan/ad network dari reader page reference.
- Exact clone spacing/warna/pixel; kita ambil prinsip dan pattern saja.

## 5. User Flows

### 5.1 Reader mencari dan membaca
1. User buka `/`.
2. User melihat latest update atau masuk `/series`.
3. User search/filter series.
4. User buka `/series/[slug]`.
5. User pilih chapter.
6. User membaca di `/series/[slug]/[chapterSlug]` dengan vertical scroll.
7. Browser menyimpan last-read ke localStorage.
8. User bisa lanjut baca dari detail page atau halaman library lokal.

### 5.2 Reader lanjut baca tanpa login
1. User pernah membaca chapter.
2. localStorage menyimpan `{ seriesSlug, chapterSlug, pageIndex, scrollPercent, updatedAt }`. (locked #18)
3. Recent history menyimpan maksimal 50 item, sorted by `updatedAt`. (locked #18)
4. Saat user buka series/detail/home, sistem bisa tampilkan “Lanjut baca” / “Currently reading”.
5. Jika localStorage kosong, UI tidak menampilkan personalized state.

### 5.3 Admin publish series + chapter
1. Admin login.
2. Admin buat series dengan metadata dasar.
3. Admin upload cover atau isi cover URL.
4. Admin buat chapter dalam status draft.
5. Admin upload/input page images.
6. Admin reorder pages.
7. Admin preview reader.
8. Admin publish chapter.
9. Chapter muncul di latest update dan detail series.

### 5.4 Admin edit konten
1. Admin buka list series/chapter.
2. Admin edit metadata atau page order.
3. Jika chapter sudah published, perubahan perlu preview sebelum save final.
4. Update latest timestamp hanya jika perubahan memang relevan ke publik.

### 5.5 Reader chrome interaction
1. User membuka chapter reader.
2. Header tampil saat load pertama.
3. Saat user scroll down, header auto-hide agar layar fokus ke gambar. (locked #15)
4. Saat user scroll up atau tap area reader, header muncul lagi. (locked #15, #21)
5. Top progress bar tetap tipis/low-noise; page counter muncul saat chrome aktif. (locked #16)

### 5.6 Image loading & recovery
1. Chapter pages dirender sebagai list vertical.
2. Image di luar viewport lazy-loaded.
3. Sistem preload 2-3 page berikutnya. (locked #17)
4. Sambil load, tampil skeleton gelap.
5. Jika satu image gagal, hanya page itu yang tampil error card + retry. (locked #22)
6. Chapter tetap bisa discroll; error satu page tidak memblokir semua reader.

## 6. Data Model

Draft model awal untuk platform reader manga/manhwa/manhua.

Fase 1-2 shape ini hidup sebagai TypeScript typed seed data di repo. Fase 3 shape yang sama dimigrasikan ke Go structs + PostgreSQL tables. (locked #29, #30)

```ts
// Fase 1-2 frontend seed contract
SeriesSeed {
  slug, title, altTitles[], synopsis, coverUrl,
  type, status, contentRating, demographic,
  authorName, artistName, releaseYear,
  genres[], chapters[]
}
ChapterSeed {
  slug, numberLabel, numberSort, title, publishedAt, pages[]
}
ChapterPageSeed {
  pageNumber, imageUrl, width?, height?
}
```

Target backend model nanti:

```text
AdminUser {
  ID, Name, Email, PasswordHash, Role, IsActive,
  CreatedAt, UpdatedAt, LastLoginAt
}

Series {
  ID, Title, Slug, Synopsis, CoverObjectKey, CoverURL,
  Type, Status, ContentRating, Demographic,
  AuthorName, ArtistName, ReleaseYear,
  IsPublished, LatestChapterID, LatestUpdatedAt,
  CreatedAt, UpdatedAt
}

SeriesAlternativeTitle {
  ID, SeriesID, Title
}

Genre {
  ID, Name, Slug
}

SeriesGenre {
  SeriesID, GenreID
}

Chapter {
  ID, SeriesID, NumberLabel, NumberSort, Slug, Title,
  Status, PublishedAt, IsPublished,
  CreatedAt, UpdatedAt
}

ChapterPage {
  ID, ChapterID, PageNumber,
  ImageObjectKey, ImageURL, Width, Height, SizeBytes,
  LoadStatus?, RetryCount?,
  CreatedAt, UpdatedAt
}
```

### 6.1 Catatan model
- `Series` dipakai sebagai istilah internal agar netral untuk Manga/Manhwa/Manhua. (locked #7)
- `NumberLabel` string untuk fleksibel: `1`, `1.5`, `Special`, `Extra`.
- `NumberSort` numeric/decimal opsional untuk sorting chapter yang stabil.
- `CoverObjectKey` / `ImageObjectKey` disiapkan untuk object storage; `CoverURL` / `ImageURL` bisa dipakai sementara pada fase seed/static.
- Reader progress MVP tidak masuk database karena disimpan localStorage. (locked #10)
- `ContentRating` disiapkan untuk boundary konten, adult filter, atau policy masa depan.
- `Demographic` disiapkan sebagai filter lanjutan: Shounen, Shoujo, Seinen, Josei, Kids, General, atau Unknown. (locked #24)
- `LoadStatus?` / `RetryCount?` bukan wajib kolom DB; bisa jadi runtime state di frontend reader untuk error/retry per image. (locked #22)
- Shape localStorage reader progress:

```json
{
  "version": 1,
  "recent": [
    {
      "seriesSlug": "example-series",
      "chapterSlug": "chapter-12",
      "pageIndex": 8,
      "scrollPercent": 42.5,
      "updatedAt": "2026-05-30T00:00:00.000Z"
    }
  ]
}
```

- `recent` maksimal 50 item; key storage kandidat: `gomic:reading-progress:v1`. (locked #18)

### 6.2 Indexes awal
- Unique `Series.Slug`.
- Unique `Genre.Slug`.
- Unique `(Chapter.SeriesID, Chapter.Slug)`.
- Index `Series.Type`, `Series.Status`, `Series.ContentRating`, `Series.Demographic`, `Series.IsPublished`, `Series.LatestUpdatedAt`.
- Index `Chapter.SeriesID`, `Chapter.IsPublished`, `Chapter.NumberSort`.

## 7. API Endpoints

Draft jika backend/API dipakai:

```text
# Public
GET    /api/series
GET    /api/series/:slug
GET    /api/series/:slug/chapters
GET    /api/series/:slug/chapters/:chapterSlug
GET    /api/genres

# Admin auth
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/auth/me

# Admin series
GET    /api/admin/series
POST   /api/admin/series
GET    /api/admin/series/:id
PATCH  /api/admin/series/:id
DELETE /api/admin/series/:id
POST   /api/admin/series/:id/publish
POST   /api/admin/series/:id/unpublish

# Admin chapters
GET    /api/admin/series/:id/chapters
POST   /api/admin/series/:id/chapters
GET    /api/admin/chapters/:id
PATCH  /api/admin/chapters/:id
DELETE /api/admin/chapters/:id
POST   /api/admin/chapters/:id/publish
POST   /api/admin/chapters/:id/unpublish
POST   /api/admin/chapters/:id/pages/reorder

# Admin assets
POST   /api/admin/uploads/cover
POST   /api/admin/uploads/chapter-page
```

### 7.1 Query public katalog
`GET /api/series` perlu support:
- `q` search title/alternative title.
- `genre` slug.
- `type` Manga/Manhwa/Manhua.
- `status` Ongoing/Completed/Hiatus/Dropped.
- `contentRating` safe/suggestive/adult policy sesuai keputusan legal nanti.
- `demographic` Shounen/Shoujo/Seinen/Josei/Kids/General/Unknown.
- `sort` latest/title/hot/trending-ready.
- pagination.

## 8. Routes / Screens

### 8.1 Public routes
- `/` — landing + latest update + CTA katalog; layout siap Hot/Trending/Recently Added. (locked #23)
- `/series` — katalog, search, filter genre/type/status/content rating/demographic.
- `/series/[slug]` — detail series + chapter list + continue reading local state.
- `/series/[slug]/[chapterSlug]` — reader vertical scroll dengan auto-hide chrome. (locked #14-#22)
- `/library` — local-only reading history/bookmark dari localStorage; tidak butuh login.

### 8.2 Admin routes
- `/admin/login` — admin login.
- `/admin` — dashboard ringkas.
- `/admin/series` — list/manage series.
- `/admin/series/new` — create series.
- `/admin/series/[id]` — edit metadata series.
- `/admin/series/[id]/chapters` — manage chapters.
- `/admin/chapters/[id]` — edit chapter + pages + reorder + preview.

## 9. Project Structure

Draft kalau memakai Next.js:

```text
gomic/
  PROJECT_IDEAS.md
  LOCAL_AI_CONTEXT.md
  src/
    app/
      page.tsx
      series/
      admin/
      api/
    components/
      reader/
        ReaderChrome.tsx
        ReaderProgressBar.tsx
        ReaderImage.tsx
        ReaderSettings.tsx
        ChapterNavigation.tsx
      series/
      admin/
      ui/
    features/
      series/
      reader/
      admin-content/
      admin-auth/
    lib/
      storage/
      auth/
      local-reading-progress/
        schema.ts
        read.ts
        write.ts
      reader/
        preload.ts
        page-detection.ts
    styles/
  public/
    placeholder-covers/
    placeholder-pages/
```

### 9.1 Catatan struktur
- `local-reading-progress` khusus helper localStorage agar progress reader tidak nyebar di komponen.
- `reader/preload.ts` dan `reader/page-detection.ts` memisahkan behavior reader dari UI component.
- `storage` dibungkus interface dari awal supaya gampang pindah dari local/static URL ke object storage.
- Admin dan public feature dipisah biar UI reader tidak tercampur logic admin.

## 10. Phasing / Roadmap

### Fase 0 — Product scope & reader UX lock
- Lock domain: manga/manhwa/manhua online reader. DONE v0.2.
- Lock reader MVP: mobile-first vertical scroll + local progress. DONE v0.2.
- Recon benchmark comix.to secara pasif. DONE v0.3.
- Lock detail reader UX: header behavior, progress, image loading, error state, navigation, localStorage. DONE v0.3.
- Bedah content/legal boundary.
- Pilih stack final.

### Fase 1 — Foundation
- Scaffold Next.js App Router + TypeScript. (locked #25, #33)
- Setup Tailwind CSS + design tokens dark-first, mobile-first, clean utilitarian; referensi visual comix.to v0.3.1. (locked #26)
- Setup lint/typecheck/build.
- Buat `LOCAL_AI_CONTEXT.md` setelah scaffold baseline.
- Buat typed seed data minimal untuk 3-5 series + beberapa chapter contoh. (locked #29)
- Buat data access module yang replaceable: seed repository sekarang, API client nanti. (locked #30)
- Buat public shell routes awal: `/`, `/series`, `/series/[slug]`, `/series/[slug]/[chapterSlug]`, `/library` placeholder. (locked #33)
- Commit baseline.

### Fase 2 — Public MVP browsing/reader
- Homepage latest update + layout siap Hot/Trending/Recently Added. (locked #23)
- Katalog `/series` dengan search/filter.
- Detail series + chapter list.
- Reader vertical scroll only. (locked #14)
- Reader chrome auto-hide + progress indicator + chapter navigation. (locked #15, #16, #19)
- Image lazy-load/preload/retry. (locked #17, #22)
- localStorage reading progress + recent history + `/library` local. (locked #18)
- Responsive QA mobile.

### Fase 3 — Go API + Admin MVP
- Scaffold Go API service. (locked #27)
- PostgreSQL schema/migrations untuk Series/Chapter/Page/Genre/AdminUser. (locked #28)
- Public API parity dengan seed repository: series list/detail/chapter/genres.
- Migrasi seed data ke DB.
- Admin login.
- CRUD series.
- CRUD chapter.
- Manage chapter pages + reorder.
- Draft/publish + preview.
- Frontend data layer switch dari seed repository ke API client.

### Fase 4 — Storage & deploy hardening
- Object storage/CDN decision + implementation. (locked #31)
- Upload validation: mime sniff, size limit, image dimensions, filename sanitize.
- SEO: metadata, sitemap, robots.
- Deployment target + healthcheck.

### Fase 5 — Growth features
- User login publik.
- Bookmark/history sync.
- Trending/popular analytics.
- Comment/rating/report broken chapter.
- Bulk import/scraper jika legal boundary sudah jelas.

## 11. Risks / Concerns

- Copyright/legal boundary harus jelas sebelum upload/import massal. (locked #12)
- Image-heavy reader butuh storage/CDN yang benar agar tidak berat dan mahal.
- Reader UX mobile harus jadi prioritas; desktop polish jangan mengalahkan mobile.
- Auto-hide chrome harus diuji agar tidak bikin user bingung mencari navigation.
- Preload image terlalu agresif bisa boros bandwidth; batas awal 2-3 page harus dievaluasi.
- localStorage bisa penuh/stale; recent history dibatasi 50 item dan versioned key.
- Chapter numbering fleksibel bisa bikin sorting kacau kalau `NumberSort` tidak dirancang dari awal.
- Admin upload banyak image perlu validasi size/type agar tidak bikin storage bengkak.
- Tanpa user login, progress localStorage tidak sinkron antar device — diterima untuk MVP. (locked #10)
- Scraper/import otomatis jangan masuk awal karena bisa memperbesar risiko legal dan teknis.

## 12. Open Decisions Tersisa (v0.4)

1. **Content/legal boundary:** sumber konten dari mana, bahasa apa, adult content policy gimana?
2. **Design direction detail:** dark clean utilitarian sudah condong, tapi brand color/logo/typography final belum.
3. **Deploy target:** lokal dulu, rdpkhorur, Vercel, VPS custom, atau lainnya?
4. **Reference depth:** cukup comix.to sebagai benchmark awal atau tambah 2-3 referensi lain sebelum design final?
5. **Go framework nanti:** stdlib/chi, Fiber, Gin, atau Echo saat Fase 3? Default rekomendasi nanti: chi/std net/http atau Fiber tergantung style project.

## 13. Deploy Strategy

Belum dikunci.

Rekomendasi bertahap:
1. Local dev dulu untuk scope dan UI reader.
2. Preview deploy setelah Fase 2 public reader stabil.
3. Backend/admin deploy setelah Fase 3.
4. Storage/CDN serius sebelum konten banyak.

Opsi kandidat:
- Vercel/Netlify untuk frontend cepat kalau API minimal.
- VPS/server kalau pakai backend terpisah, database, dan object storage integration.
- Static preview jika Fase 1-2 masih seed data tanpa admin.

## 14. Frontend Development Arsenal

Rekomendasi awal:
- Tailwind CSS untuk mobile-first layout.
- shadcn/ui untuk admin forms/table/dialog jika pakai React/Next.
- Zustand atau helper localStorage custom untuk reading progress.
- TanStack Query kalau public/admin API sudah ada.
- Embla/Swiper tidak prioritas karena reader MVP vertical scroll, bukan carousel.
- Image component/optimization perlu dikaji sesuai storage/deploy target.

### 14.1 Reader UI principles
- Dark-first dengan charcoal/near-black reader surface.
- Content width nyaman di mobile dan desktop: full-width mobile, centered strip desktop.
- Tidak terlalu banyak chrome/navigation saat membaca.
- Header auto-hide, bukan sticky berat. (locked #15)
- Loading state harus halus karena chapter image banyak.
- Error per image/page harus recoverable. (locked #22)
- Progress harus informatif tapi low-noise: thin bar + page counter saat chrome aktif. (locked #16)
- Benchmark comix.to dipakai untuk pattern, bukan visual clone 1:1. (locked #13)
- Poster-dominant cards + compact metadata cocok untuk discovery.
- Detail page perlu CTA baca yang jelas, chips metadata, dan chapter list cepat discan.
- Hindari ad-network/noisy monetization di reader MVP.

## 15. Implementation Notes

- Jangan mulai coding app sebelum stack + MVP data source dikunci.
- Dokumen ini akan terus di-update; v0.x dianggap living plan.
- Locked decisions append-only; kalau berubah, tambahkan row baru atau tandai replaced.
- Kalau project mulai implementasi, buat `LOCAL_AI_CONTEXT.md` sebagai pointer operasional lintas sesi.
- Untuk ide baru, tambahkan ke section terkait dan bump versi minor.

## 16. Current Next Step

**v0.5 implementation status: Fase 1-2 frontend reader MVP completed and build-verified.**




Changelog v0.6 → v0.7:
- Added frontend API-first catalog adapter in `web/src/lib/catalog.ts`.
- Added shared web response types for summaries/details/reader payloads.
- Wired home, catalog, detail, reader, and library pages to async data source.
- Added `NEXT_PUBLIC_API_BASE_URL` support with seed fallback when env is unset or API fetch fails.
- Added `web/.env.example`.
- Validation: `npm run lint`, `npm run build`, API-backed `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080 npm run build`, and `go test ./...` pass.

Recommended next phase:
1. Implement PostgreSQL repository in Go behind catalog behavior.
2. Add migration runner/DB config and seed import path.
3. Keep in-memory seed repository as dev fallback until DB is stable.

Changelog v0.5 → v0.6:
- Added Fase 3 API contract doc: `docs/fase-3-api-contract.md`.
- Added PostgreSQL schema draft: `docs/fase-3-postgres-schema.sql`.
- Scaffolded Go API under `api/` using stdlib `net/http`.
- Implemented API seed repository mirroring frontend seed data.
- Implemented endpoints: `/healthz`, `/api/v1/genres`, `/api/v1/series`, `/api/v1/series/{slug}`, `/api/v1/series/{slug}/chapters/{chapterSlug}`.
- Validation: `go test ./...` passes and manual HTTP smoke test passed.

Recommended next phase:
1. Add frontend API client switch via env flag while keeping seed fallback.
2. Wire web catalog/detail/reader to Go API when `NEXT_PUBLIC_API_BASE_URL` is set.
3. Then implement PostgreSQL repository behind the same Go catalog interface.

Changelog v0.4 → v0.5:
- Scaffold Next.js App Router app under `web/`.
- Implemented typed seed data + replaceable catalog repository.
- Implemented public routes: `/`, `/series`, `/series/[slug]`, `/series/[slug]/[chapterSlug]`, `/library`.
- Added catalog URL filters: `q`, `genre`, `type`, `status`, `demographic`, `rating`, `sort`.
- Added homepage latest/trending/genre rail/completed/continue-reading sections.
- Added reader settings persisted to localStorage: width, gap, background.
- Added reading progress persisted to localStorage + Library view.
- Added mobile bottom nav, empty states, and loading skeletons.
- Validation: `npm run lint` and `npm run build` pass in `web/`.

Recommended next phase:
1. Design Fase 3 Go API contract + PostgreSQL schema/migrations.
2. Scaffold Go service after schema is agreed.
3. Keep frontend seed repository as fallback while adding API client.

Changelog v0.3.1 → v0.4:
- Locked decisions added: #25-#33.
- Frontend locked: Next.js App Router + TypeScript + Tailwind custom public UI.
- Backend target locked: Go API + PostgreSQL mulai Fase 3, bukan blocker Fase 1-2.
- MVP data strategy locked: typed static seed data untuk public reader awal.
- Fase 1 scope expanded: scaffold Next baseline, design tokens, seed repo, replaceable data layer, public shell routes.

Execution options sekarang:
1. **Gas Fase 1 inline sekarang** — scaffold Next.js baseline di repo ini, install deps, build check. Rekomendasi gua.
2. Review dulu v0.4 sebelum coding.
3. Bedah content/legal boundary dulu sebelum scaffold.
4. Stop/pause.

Changelog v0.3 → v0.3.1:
- Chromium Playwright berhasil diinstall dan dipakai render visual.
- Captured: `recon/comix/visual/home-desktop.png`, `home-mobile.png`, `detail-desktop.png`, `detail-mobile.png`, `reader-desktop.png`, `reader-mobile.png`.
- Koreksi catatan lama: visual browser sekarang tersedia; sebelumnya hanya gagal di browser tool bawaan Hermes.
- Visual takeaways ditambahkan ke Section 4.6 dan Section 14.1.

Changelog v0.2 → v0.3:
- Recon pasif comix.to: HTML/meta/initial data/assets/style strings berhasil; visual kemudian dilengkapi di v0.3.1 via Playwright manual.
- Locked decisions added: #13-#24.
- Reader UX locked: vertical scroll only, auto-hide header, progress bar + page counter, lazy-load/preload/retry, localStorage recent max 50, chapter dropdown + end CTA, settings minimal, tap toggle chrome.
- Content/discovery enriched: alt titles, content rating, demographic, Hot/Trending/Recently Added-ready homepage hierarchy.
- Sections updated: Features, Flows, Data Model, API query, Routes, Project Structure, Phasing, Risks, Open Decisions, UI principles.

Next eksplorasi yang paling masuk akal:

1. **Bedah stack final** — rekomendasi gua: tentukan apakah mulai Next.js fullstack seed/static dulu atau langsung DB+admin.
2. Bedah content/legal boundary — sumber konten, bahasa, adult policy, import/scrape boleh/tidak.
3. Bedah design direction — dark manga reader minimal vs anime colorful vs clean modern neutral.
4. Tambah referensi web lain sebelum design final.

Current next action: implement PostgreSQL repository + migrations in Go, keeping seed fallback for local dev.

### Changelog v0.8 — PostgreSQL repository path
- Added Go catalog `Store` interface so HTTP handlers can use either seed or PostgreSQL repositories.
- Added PostgreSQL repository implementation in `api/internal/catalog/postgres.go` for list/detail/chapter/genres endpoints.
- Added `api/internal/config` env loading: `DATABASE_URL` enables PostgreSQL; unset env keeps seed fallback; `GOMIC_USE_SEED=1` forces seed mode.
- Added migration runner `api/cmd/migrate`, seed importer `api/cmd/seed`, and SQL migration `api/migrations/001_catalog_schema.sql`.
- Validation: `go test ./...` passed; seed-mode API smoke test passed on health, genres, series list, detail, and chapter reader endpoints.

Next recommended step after v0.8:
1. Run against a real local PostgreSQL database using `DATABASE_URL`.
2. Add handler/repository tests around the PostgreSQL-backed behavior.
3. Start admin auth/content CRUD once DB read path is verified.
### Changelog v0.9 — API tests + local PostgreSQL compose
- Added root `docker-compose.yml` for local PostgreSQL dev (`gomic` / `gomic_dev_password`).
- Added seed repository tests in `api/internal/catalog/repository_test.go` for filters, pagination, detail, chapter reader, and not found cases.
- Added HTTP handler tests in `api/internal/httpapi/handler_test.go` for health/catalog endpoints, response envelope meta, and 404 error envelope.
- Validation: `go test ./...` passed.
- Environment note: Docker CLI exists, but Docker daemon was not running, so real PostgreSQL migration/seed smoke is pending.

Next recommended step after v0.9:
1. Start Docker Desktop, then run the local postgres service from project root.
2. From `api/`, run migration + seed against `postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable`.
3. Smoke test API in PostgreSQL mode, then wire admin auth/content CRUD.
### Changelog v0.10 — Admin API scaffold
- Added shared-token admin auth scaffold via `ADMIN_TOKEN` and `POST /api/v1/admin/login`.
- Added protected admin series endpoints: `GET /api/v1/admin/series` and `POST /api/v1/admin/series`.
- Added seed-backed admin series upsert path in `api/internal/catalog/admin.go` for local/dev iteration before full PostgreSQL writes.
- Added admin API tests in `api/internal/httpapi/admin_test.go`.
- Validation: `go test ./...` passed; admin seed-mode smoke test passed for login, protected series upsert, and public detail readback.
- Environment note: Docker daemon is still unavailable, so PostgreSQL migration/seed smoke remains pending.

Next recommended step after v0.10:
1. Add PostgreSQL write implementation for admin series upsert behind `AdminStore`.
2. Add chapter/page admin CRUD endpoints.
3. Build a minimal admin UI once backend content CRUD shape is stable.
### Changelog v0.11 — PostgreSQL admin series write path
- Added PostgreSQL implementation for `AdminStore.UpsertSeries` in `api/internal/catalog/postgres.go`.
- Admin series upsert now writes `series`, replaces `series_genres`, upserts missing `genres`, and returns public `SeriesDetail` readback.
- Added catalog admin tests in `api/internal/catalog/admin_test.go` for seed upsert/create/update validation and genre slugification.
- Updated docs to note admin series create/update is wired for seed and PostgreSQL modes.
- Validation: `go test ./...` passed.
- Environment note: Docker daemon is still unavailable, so real PostgreSQL migration/seed/admin write smoke remains pending.

Next recommended step after v0.11:
1. Add admin chapter/page CRUD endpoints behind `AdminStore`.
2. Once Docker Desktop is running, smoke test migration, seed, and admin writes against PostgreSQL.
3. Start minimal admin UI after content CRUD endpoints stabilize.
