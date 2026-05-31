from pathlib import Path
p = Path('PROJECT_IDEAS.md')
s = p.read_text(encoding='utf-8')
s = s.replace('> Status: v0.3.1 — comix.to visual capture added', '> Status: v0.4 — stack + phased implementation strategy locked')
s = s.replace('- [0. Locked Decisions](#0-locked-decisions-v03)', '- [0. Locked Decisions](#0-locked-decisions-v04)')
s = s.replace('- [12. Open Decisions Tersisa (v0.3)](#12-open-decisions-tersisa-v03)', '- [12. Open Decisions Tersisa (v0.4)](#12-open-decisions-tersisa-v04)')
s = s.replace('## 0. Locked Decisions (v0.3)', '## 0. Locked Decisions (v0.4)')
s = s.replace('## 12. Open Decisions Tersisa (v0.3)', '## 12. Open Decisions Tersisa (v0.4)')
old = '| 24 | Metadata enrichment from reference | **Alt titles, content rating, demographic, author, artist** disiapkan di model/filter walau sebagian bisa hidden di MVP. |'
new = old + '''
| 25 | Frontend stack | **Next.js App Router + TypeScript** untuk SEO public pages, routing reader/detail, dan iterasi UI cepat. |
| 26 | Styling stack | **Tailwind CSS + custom public components**; shadcn/ui ditunda untuk admin/forms saat Fase 3. |
| 27 | Backend target | **Go API sebagai backend final** untuk catalog/admin/auth/upload/storage lifecycle. |
| 28 | Database target | **PostgreSQL saat backend Go masuk**; tidak wajib di Fase 1-2. |
| 29 | MVP data strategy | **Fase 1-2 pakai typed static seed data di repo** supaya reader/home/detail cepat divalidasi. |
| 30 | Backend phasing | **No real DB/backend dependency sampai Fase 3**; data layer dibuat replaceable agar migrasi ke Go API rapi. |
| 31 | Storage phasing | **Static placeholder/local public assets dulu**; object storage/CDN masuk Fase 4. |
| 32 | Local state strategy | **Custom typed localStorage helper** untuk reading progress; Zustand ditunda sampai state makin kompleks. |
| 33 | Fase 1 execution scope | **Scaffold Next.js baseline + theme tokens + seed data + public shell routes**, belum admin/Go API real. |'''
s = s.replace(old, new)
old = '''### 3.1 Rekomendasi stack MVP
- **Frontend:** Next.js/React, mobile-first.
- **Styling:** Tailwind CSS.
- **UI admin:** shadcn/ui atau komponen custom sederhana.
- **Database:** PostgreSQL saat backend masuk.
- **Backend:** bisa Next.js route handlers untuk MVP cepat, atau Go/Fiber kalau mau backend terpisah dan scalable dari awal.
- **Storage:** object storage/CDN untuk cover dan chapter page images saat upload serius.

### 3.2 Stack decision belum dikunci penuh
Stack final tunggu keputusan apakah MVP langsung butuh backend+admin real, atau kita mulai dengan static/seed data untuk validasi reader UX dulu.'''
new = '''### 3.1 Stack locked v0.4
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
- Data access di frontend tetap lewat module/repository internal agar gampang diganti dari seed data ke API client. (locked #30)'''
s = s.replace(old, new)
old = '''- Cloud bookmark/history sync.'''
new = '''- Cloud bookmark/history sync.
- Go API + PostgreSQL real sebelum Fase 3.'''
s = s.replace(old, new)
old = '''## 6. Data Model

Draft model awal untuk platform reader manga/manhwa/manhua:'''
new = '''## 6. Data Model

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

Target backend model nanti:'''
s = s.replace(old, new)
old = '''### Fase 1 — Foundation
- Scaffold project sesuai stack final.
- Setup lint/typecheck/build.
- Buat `LOCAL_AI_CONTEXT.md` setelah stack jelas.
- Setup design tokens/theme dasar: dark-first, mobile-first, clean utilitarian; referensi visual comix.to v0.3.1.
- Seed data minimal untuk 3-5 series + beberapa chapter contoh.
- Commit baseline.'''
new = '''### Fase 1 — Foundation
- Scaffold Next.js App Router + TypeScript. (locked #25, #33)
- Setup Tailwind CSS + design tokens dark-first, mobile-first, clean utilitarian; referensi visual comix.to v0.3.1. (locked #26)
- Setup lint/typecheck/build.
- Buat `LOCAL_AI_CONTEXT.md` setelah scaffold baseline.
- Buat typed seed data minimal untuk 3-5 series + beberapa chapter contoh. (locked #29)
- Buat data access module yang replaceable: seed repository sekarang, API client nanti. (locked #30)
- Buat public shell routes awal: `/`, `/series`, `/series/[slug]`, `/series/[slug]/[chapterSlug]`, `/library` placeholder. (locked #33)
- Commit baseline.'''
s = s.replace(old, new)
old = '''### Fase 3 — Admin MVP
- Admin login.
- CRUD series.
- CRUD chapter.
- Manage chapter pages + reorder.
- Draft/publish + preview.'''
new = '''### Fase 3 — Go API + Admin MVP
- Scaffold Go API service. (locked #27)
- PostgreSQL schema/migrations untuk Series/Chapter/Page/Genre/AdminUser. (locked #28)
- Public API parity dengan seed repository: series list/detail/chapter/genres.
- Migrasi seed data ke DB.
- Admin login.
- CRUD series.
- CRUD chapter.
- Manage chapter pages + reorder.
- Draft/publish + preview.
- Frontend data layer switch dari seed repository ke API client.'''
s = s.replace(old, new)
old = '''### Fase 4 — Storage & deploy hardening
- Object storage/CDN decision.'''
new = '''### Fase 4 — Storage & deploy hardening
- Object storage/CDN decision + implementation. (locked #31)'''
s = s.replace(old, new)
old = '''1. **Stack final:** Next.js fullstack, Next.js + Go API, atau stack lain?
2. **MVP data source:** seed/static dulu atau langsung database + admin real?
3. **Storage awal:** URL/static placeholder dulu atau langsung object storage?
4. **Content/legal boundary:** sumber konten dari mana, bahasa apa, adult content policy gimana?
5. **Design direction:** dark manga reader minimal, anime colorful, atau clean modern neutral?
6. **Deploy target:** lokal dulu, rdpkhorur, Vercel, VPS custom, atau lainnya?
7. **Reference depth:** cukup comix.to sebagai benchmark awal atau tambah 2-3 referensi lain sebelum design final?'''
new = '''1. **Content/legal boundary:** sumber konten dari mana, bahasa apa, adult content policy gimana?
2. **Design direction detail:** dark clean utilitarian sudah condong, tapi brand color/logo/typography final belum.
3. **Deploy target:** lokal dulu, rdpkhorur, Vercel, VPS custom, atau lainnya?
4. **Reference depth:** cukup comix.to sebagai benchmark awal atau tambah 2-3 referensi lain sebelum design final?
5. **Go framework nanti:** stdlib/chi, Fiber, Gin, atau Echo saat Fase 3? Default rekomendasi nanti: chi/std net/http atau Fiber tergantung style project.'''
s = s.replace(old, new)
old = '''**v0.3.1 menambahkan visual capture comix.to untuk homepage/detail/reader.**'''
new = '''**v0.4 lock stack + phased implementation strategy; siap eksekusi Fase 1.**

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
4. Stop/pause.'''
s = s.replace(old, new)
s = s.replace('Kalau lu lanjut ikut rekomendasi, update berikutnya jadi v0.4: lock stack + MVP data-source strategy sebelum coding.', 'Karena user sudah minta eksekusi Fase 1, next action: scaffold baseline lalu validasi build.')
p.write_text(s, encoding='utf-8')
print('updated', len(s.splitlines()))
