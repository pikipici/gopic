from pathlib import Path
p = Path('PROJECT_IDEAS.md')
s = p.read_text(encoding='utf-8')
s = s.replace('> Status: v0.2 — domain locked: online manga/manhwa/manhua reader platform', '> Status: v0.3 — reader UX + comix.to reference locked')
s = s.replace('- [0. Locked Decisions](#0-locked-decisions-v02)', '- [0. Locked Decisions](#0-locked-decisions-v03)')
s = s.replace('- [12. Open Decisions Tersisa (v0.2)](#12-open-decisions-tersisa-v02)', '- [12. Open Decisions Tersisa (v0.3)](#12-open-decisions-tersisa-v03)')
s = s.replace('## 0. Locked Decisions (v0.2)', '## 0. Locked Decisions (v0.3)')
s = s.replace('## 12. Open Decisions Tersisa (v0.2)', '## 12. Open Decisions Tersisa (v0.3)')
old = '| 12 | Legal/content boundary | **Plan harus eksplisit soal sumber konten dan risiko copyright** sebelum import/scrape/upload massal. |'
new = old + '''
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
| 24 | Metadata enrichment from reference | **Alt titles, content rating, demographic, author, artist** disiapkan di model/filter walau sebagian bisa hidden di MVP. |'''
s = s.replace(old, new)
old = '''### 4.1 Reader experience
- Mobile-first vertical scroll reader. (locked #6)
- Lazy-load chapter page images.
- Preload ringan untuk halaman berikutnya / chapter berikutnya jika memungkinkan.
- Prev/next chapter navigation.
- Auto-save last-read di localStorage. (locked #10)
- Dark mode sebagai default kuat untuk pengalaman baca malam.
- Reader settings minimal: fit width, spacing, theme.'''
new = '''### 4.1 Reader experience
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
- Tap mobile untuk toggle chrome; swipe next ditunda. (locked #21)'''
s = s.replace(old, new)
old = '''### 4.2 Content & detail
- Series sebagai entity utama. (locked #7)
- Type: Manga / Manhwa / Manhua.
- Metadata: title, alternative titles, slug, synopsis, cover, type, status, genres, author/artist, release year opsional.
- Detail page dengan cover, synopsis, genre, status, chapter list, latest chapter.
- Chapter numbering harus fleksibel: `1`, `1.5`, `10.2`, `Special`, `Extra`.'''
new = '''### 4.2 Content & detail
- Series sebagai entity utama. (locked #7)
- Type: Manga / Manhwa / Manhua.
- Metadata: title, alternative titles, slug, synopsis, cover, type, status, genres, author/artist, release year opsional.
- Metadata enrichment: content rating dan demographic disiapkan dari awal. (locked #24)
- Detail page dengan cover, synopsis, genre, status, chapter list, latest chapter.
- Chapter numbering harus fleksibel: `1`, `1.5`, `10.2`, `Special`, `Extra`.'''
s = s.replace(old, new)
old = '''### 4.3 Discovery / katalog
- Homepage latest update. (locked #8)
- Search title dan alternative titles.
- Filter genre.
- Filter type: Manga / Manhwa / Manhua.
- Filter status: Ongoing / Completed / Hiatus / Dropped.
- Katalog responsive dengan cards.'''
new = '''### 4.3 Discovery / katalog
- Homepage latest update. (locked #8)
- Struktur homepage siap berkembang ke Hot/Trending/Recently Added seperti benchmark comix.to. (locked #13, #23)
- Search title dan alternative titles.
- Filter genre.
- Filter type: Manga / Manhwa / Manhua.
- Filter status: Ongoing / Completed / Hiatus / Dropped.
- Filter lanjutan nanti: content rating dan demographic. (locked #24)
- Katalog responsive dengan cards.'''
s = s.replace(old, new)
insert_after = '''### 4.5 Deferred / bukan MVP
- User login publik.
- Cloud bookmark/history sync.
- Comment/rating.
- Trending/popular real analytics.
- Scraper/import otomatis.
- Contributor/author upload.
- Payment/premium.
- Mobile app native.'''
addition = insert_after + '''

### 4.6 Reference notes — comix.to
Recon pasif 2026-05-30 menemukan pola yang relevan:
- Dark theme default.
- Homepage memakai beberapa bucket: trending, top/follows, hot/latest update, newly created, comments, collections, top uploaders.
- Content model memuat `title`, `altTitles`, `type`, `contentRating`, `status`, `year`.
- UI punya konsep card compact, add to library/bookmark, advanced filters, content rating, demographic, comments, collections, PWA/install.

Yang kita adopsi untuk Gomic:
- Pattern dark-first, mobile-first, card-based discovery.
- Metadata kaya: alt titles, content rating, demographic, author/artist.
- Homepage hierarchy siap Hot/Trending/Latest, tapi MVP tetap Latest + Search/Filter.
- Continue reading/currently reading lewat localStorage.

Yang tidak masuk MVP:
- Comments.
- Collections publik.
- Top uploaders.
- PWA/install.
- Social login/user account.
- Copy aset/logo/CSS/content comix.to.'''
s = s.replace(insert_after, addition)
old = '''### 5.2 Reader lanjut baca tanpa login
1. User pernah membaca chapter.
2. localStorage menyimpan `{ seriesSlug, chapterSlug, pageIndex/scrollProgress, updatedAt }`.
3. Saat user buka series/detail/home, sistem bisa tampilkan “Lanjut baca”.
4. Jika localStorage kosong, UI tidak menampilkan personalized state.'''
new = '''### 5.2 Reader lanjut baca tanpa login
1. User pernah membaca chapter.
2. localStorage menyimpan `{ seriesSlug, chapterSlug, pageIndex, scrollPercent, updatedAt }`. (locked #18)
3. Recent history menyimpan maksimal 50 item, sorted by `updatedAt`. (locked #18)
4. Saat user buka series/detail/home, sistem bisa tampilkan “Lanjut baca” / “Currently reading”.
5. Jika localStorage kosong, UI tidak menampilkan personalized state.'''
s = s.replace(old, new)
insert_after = '''### 5.4 Admin edit konten
1. Admin buka list series/chapter.
2. Admin edit metadata atau page order.
3. Jika chapter sudah published, perubahan perlu preview sebelum save final.
4. Update latest timestamp hanya jika perubahan memang relevan ke publik.'''
addition = insert_after + '''

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
6. Chapter tetap bisa discroll; error satu page tidak memblokir semua reader.'''
s = s.replace(insert_after, addition)
old = '''Series {
  ID, Title, Slug, Synopsis, CoverObjectKey, CoverURL,
  Type, Status, ContentRating,
  AuthorName, ArtistName, ReleaseYear,
  IsPublished, LatestChapterID, LatestUpdatedAt,
  CreatedAt, UpdatedAt
}'''
new = '''Series {
  ID, Title, Slug, Synopsis, CoverObjectKey, CoverURL,
  Type, Status, ContentRating, Demographic,
  AuthorName, ArtistName, ReleaseYear,
  IsPublished, LatestChapterID, LatestUpdatedAt,
  CreatedAt, UpdatedAt
}'''
s = s.replace(old, new)
old = '''ChapterPage {
  ID, ChapterID, PageNumber,
  ImageObjectKey, ImageURL, Width, Height, SizeBytes,
  CreatedAt, UpdatedAt
}'''
new = '''ChapterPage {
  ID, ChapterID, PageNumber,
  ImageObjectKey, ImageURL, Width, Height, SizeBytes,
  LoadStatus?, RetryCount?,
  CreatedAt, UpdatedAt
}'''
s = s.replace(old, new)
old = '''- `ContentRating` disiapkan untuk boundary konten, adult filter, atau policy masa depan.'''
new = '''- `ContentRating` disiapkan untuk boundary konten, adult filter, atau policy masa depan.
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

- `recent` maksimal 50 item; key storage kandidat: `gomic:reading-progress:v1`. (locked #18)'''
s = s.replace(old, new)
old = '''- Index `Series.Type`, `Series.Status`, `Series.IsPublished`, `Series.LatestUpdatedAt`.'''
new = '''- Index `Series.Type`, `Series.Status`, `Series.ContentRating`, `Series.Demographic`, `Series.IsPublished`, `Series.LatestUpdatedAt`.'''
s = s.replace(old, new)
old = '''- `status` Ongoing/Completed/Hiatus/Dropped.
- `sort` latest/title.
- pagination.'''
new = '''- `status` Ongoing/Completed/Hiatus/Dropped.
- `contentRating` safe/suggestive/adult policy sesuai keputusan legal nanti.
- `demographic` Shounen/Shoujo/Seinen/Josei/Kids/General/Unknown.
- `sort` latest/title/hot/trending-ready.
- pagination.'''
s = s.replace(old, new)
old = '''### 8.1 Public routes
- `/` — landing + latest update + CTA katalog.
- `/series` — katalog, search, filter genre/type/status.
- `/series/[slug]` — detail series + chapter list + continue reading local state.
- `/series/[slug]/[chapterSlug]` — reader vertical scroll.
- `/library` — local-only reading history/bookmark dari localStorage; tidak butuh login.'''
new = '''### 8.1 Public routes
- `/` — landing + latest update + CTA katalog; layout siap Hot/Trending/Recently Added. (locked #23)
- `/series` — katalog, search, filter genre/type/status/content rating/demographic.
- `/series/[slug]` — detail series + chapter list + continue reading local state.
- `/series/[slug]/[chapterSlug]` — reader vertical scroll dengan auto-hide chrome. (locked #14-#22)
- `/library` — local-only reading history/bookmark dari localStorage; tidak butuh login.'''
s = s.replace(old, new)
old = '''    components/
      reader/
      series/
      admin/
      ui/'''
new = '''    components/
      reader/
        ReaderChrome.tsx
        ReaderProgressBar.tsx
        ReaderImage.tsx
        ReaderSettings.tsx
        ChapterNavigation.tsx
      series/
      admin/
      ui/'''
s = s.replace(old, new)
old = '''    lib/
      storage/
      auth/
      local-reading-progress/'''
new = '''    lib/
      storage/
      auth/
      local-reading-progress/
        schema.ts
        read.ts
        write.ts
      reader/
        preload.ts
        page-detection.ts'''
s = s.replace(old, new)
old = '''- `local-reading-progress` khusus helper localStorage agar progress reader tidak nyebar di komponen.
- `storage` dibungkus interface dari awal supaya gampang pindah dari local/static URL ke object storage.
- Admin dan public feature dipisah biar UI reader tidak tercampur logic admin.'''
new = '''- `local-reading-progress` khusus helper localStorage agar progress reader tidak nyebar di komponen.
- `reader/preload.ts` dan `reader/page-detection.ts` memisahkan behavior reader dari UI component.
- `storage` dibungkus interface dari awal supaya gampang pindah dari local/static URL ke object storage.
- Admin dan public feature dipisah biar UI reader tidak tercampur logic admin.'''
s = s.replace(old, new)
old = '''### Fase 0 — Product scope & reader UX lock
- Lock domain: manga/manhwa/manhua online reader. DONE v0.2.
- Lock reader MVP: mobile-first vertical scroll + local progress. DONE v0.2.
- Bedah detail reader UX: header behavior, image loading, error state, keyboard/touch navigation.
- Bedah content/legal boundary.
- Pilih stack final.'''
new = '''### Fase 0 — Product scope & reader UX lock
- Lock domain: manga/manhwa/manhua online reader. DONE v0.2.
- Lock reader MVP: mobile-first vertical scroll + local progress. DONE v0.2.
- Recon benchmark comix.to secara pasif. DONE v0.3.
- Lock detail reader UX: header behavior, progress, image loading, error state, navigation, localStorage. DONE v0.3.
- Bedah content/legal boundary.
- Pilih stack final.'''
s = s.replace(old, new)
old = '''### Fase 2 — Public MVP browsing/reader
- Homepage latest update.
- Katalog `/series` dengan search/filter.
- Detail series + chapter list.
- Reader vertical scroll.
- localStorage reading progress + `/library` local.
- Responsive QA mobile.'''
new = '''### Fase 2 — Public MVP browsing/reader
- Homepage latest update + layout siap Hot/Trending/Recently Added. (locked #23)
- Katalog `/series` dengan search/filter.
- Detail series + chapter list.
- Reader vertical scroll only. (locked #14)
- Reader chrome auto-hide + progress indicator + chapter navigation. (locked #15, #16, #19)
- Image lazy-load/preload/retry. (locked #17, #22)
- localStorage reading progress + recent history + `/library` local. (locked #18)
- Responsive QA mobile.'''
s = s.replace(old, new)
old = '''- Reader UX mobile harus jadi prioritas; desktop polish jangan mengalahkan mobile.
- Chapter numbering fleksibel bisa bikin sorting kacau kalau `NumberSort` tidak dirancang dari awal.'''
new = '''- Reader UX mobile harus jadi prioritas; desktop polish jangan mengalahkan mobile.
- Auto-hide chrome harus diuji agar tidak bikin user bingung mencari navigation.
- Preload image terlalu agresif bisa boros bandwidth; batas awal 2-3 page harus dievaluasi.
- localStorage bisa penuh/stale; recent history dibatasi 50 item dan versioned key.
- Chapter numbering fleksibel bisa bikin sorting kacau kalau `NumberSort` tidak dirancang dari awal.'''
s = s.replace(old, new)
old = '''1. **Stack final:** Next.js fullstack, Next.js + Go API, atau stack lain?
2. **MVP data source:** seed/static dulu atau langsung database + admin real?
3. **Storage awal:** URL/static placeholder dulu atau langsung object storage?
4. **Content/legal boundary:** sumber konten dari mana, bahasa apa, adult content policy gimana?
5. **Reader UX detail:** header sticky atau auto-hide, progress indicator bentuk apa, preload seberapa agresif?
6. **Design direction:** dark manga reader minimal, anime colorful, atau clean modern neutral?
7. **Deploy target:** lokal dulu, rdpkhorur, Vercel, VPS custom, atau lainnya?'''
new = '''1. **Stack final:** Next.js fullstack, Next.js + Go API, atau stack lain?
2. **MVP data source:** seed/static dulu atau langsung database + admin real?
3. **Storage awal:** URL/static placeholder dulu atau langsung object storage?
4. **Content/legal boundary:** sumber konten dari mana, bahasa apa, adult content policy gimana?
5. **Design direction:** dark manga reader minimal, anime colorful, atau clean modern neutral?
6. **Deploy target:** lokal dulu, rdpkhorur, Vercel, VPS custom, atau lainnya?
7. **Reference depth:** cukup comix.to sebagai benchmark awal atau tambah 2-3 referensi lain sebelum design final?'''
s = s.replace(old, new)
old = '''### 14.1 Reader UI principles
- Dark-first.
- Content width nyaman di mobile dan desktop.
- Tidak terlalu banyak chrome/navigation saat membaca.
- Loading state harus halus karena chapter image banyak.
- Error per image/page harus recoverable.'''
new = '''### 14.1 Reader UI principles
- Dark-first.
- Content width nyaman di mobile dan desktop.
- Tidak terlalu banyak chrome/navigation saat membaca.
- Header auto-hide, bukan sticky berat. (locked #15)
- Loading state harus halus karena chapter image banyak.
- Error per image/page harus recoverable. (locked #22)
- Progress harus informatif tapi low-noise: thin bar + page counter saat chrome aktif. (locked #16)
- Benchmark comix.to dipakai untuk pattern, bukan visual clone 1:1. (locked #13)'''
s = s.replace(old, new)
old = '''## 16. Current Next Step

**v0.2 sudah lock arah produk dan rekomendasi MVP sementara.**

Next eksplorasi yang paling masuk akal:

1. **Bedah reader UX detail** — header, navigation, progress, image loading, error state, localStorage shape. Rekomendasi gua ini dulu.
2. Bedah stack final — Next.js fullstack vs Next.js + Go API vs lainnya.
3. Bedah content/legal boundary — sumber konten, bahasa, adult policy, import/scrape boleh/tidak.
4. Bedah design direction — visual identity, dark theme, card style, reader feel.

Kalau lu lanjut ikut rekomendasi, update berikutnya jadi v0.3: lock detail Reader UX sebelum masuk stack/kode.'''
new = '''## 16. Current Next Step

**v0.3 sudah lock Reader UX detail + benchmark comix.to sebagai referensi pattern.**

Changelog v0.2 → v0.3:
- Recon pasif comix.to: HTML/meta/initial data/assets/style strings berhasil; browser visual lokal gagal karena Chromium tidak tersedia (`WinError 2`).
- Locked decisions added: #13-#24.
- Reader UX locked: vertical scroll only, auto-hide header, progress bar + page counter, lazy-load/preload/retry, localStorage recent max 50, chapter dropdown + end CTA, settings minimal, tap toggle chrome.
- Content/discovery enriched: alt titles, content rating, demographic, Hot/Trending/Recently Added-ready homepage hierarchy.
- Sections updated: Features, Flows, Data Model, API query, Routes, Project Structure, Phasing, Risks, Open Decisions, UI principles.

Next eksplorasi yang paling masuk akal:

1. **Bedah stack final** — rekomendasi gua: tentukan apakah mulai Next.js fullstack seed/static dulu atau langsung DB+admin.
2. Bedah content/legal boundary — sumber konten, bahasa, adult policy, import/scrape boleh/tidak.
3. Bedah design direction — dark manga reader minimal vs anime colorful vs clean modern neutral.
4. Tambah referensi web lain sebelum design final.

Kalau lu lanjut ikut rekomendasi, update berikutnya jadi v0.4: lock stack + MVP data-source strategy sebelum coding.'''
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
print('updated', p, len(s.splitlines()))
