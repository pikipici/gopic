from pathlib import Path
p = Path('PROJECT_IDEAS.md')
s = p.read_text(encoding='utf-8')
s = s.replace('> Status: v0.3 — reader UX + comix.to reference locked', '> Status: v0.3.1 — comix.to visual capture added')
s = s.replace('### 4.6 Reference notes — comix.to\nRecon pasif 2026-05-30 menemukan pola yang relevan:', '### 4.6 Reference notes — comix.to\nRecon pasif + visual capture 2026-05-30 menemukan pola yang relevan:')
old = '''- UI punya konsep card compact, add to library/bookmark, advanced filters, content rating, demographic, comments, collections, PWA/install.'''
new = '''- UI punya konsep card compact, add to library/bookmark, advanced filters, content rating, demographic, comments, collections, PWA/install.
- Visual homepage: dark charcoal/teal background, Geist/system font, sticky topnav, desktop content grid 960px + sidebar 340px, mobile gutter 16px, poster-dominant 2-column cards.
- Visual detail page: hero layout dengan poster kiri, CTA `Start reading`, follow/rating actions, breadcrumbs, genre chips, chapter list, recommendations.
- Visual reader page: long-strip reader dengan background hampir hitam, images full-width mobile / centered 640px desktop, segmented progress bar tipis di kiri, settings untuk reading direction, strip margin, progress bar, dan reader controls.'''
s = s.replace(old, new)
old = '''Yang kita adopsi untuk Gomic:
- Pattern dark-first, mobile-first, card-based discovery.
- Metadata kaya: alt titles, content rating, demographic, author/artist.
- Homepage hierarchy siap Hot/Trending/Latest, tapi MVP tetap Latest + Search/Filter.
- Continue reading/currently reading lewat localStorage.'''
new = '''Yang kita adopsi untuk Gomic:
- Pattern dark-first, mobile-first, card-based discovery.
- Clean dark utilitarian direction: poster cover jadi warna utama, UI chrome low-noise.
- Metadata kaya: alt titles, content rating, demographic, author/artist.
- Homepage hierarchy siap Hot/Trending/Latest, tapi MVP tetap Latest + Search/Filter.
- Detail page memakai pola poster + CTA baca + metadata chips + chapter list.
- Reader memakai long-strip centered desktop dan full-width mobile, dengan progress bar tipis low-noise.
- Continue reading/currently reading lewat localStorage.'''
s = s.replace(old, new)
old = '''- Copy aset/logo/CSS/content comix.to.'''
new = '''- Copy aset/logo/CSS/content comix.to.
- Iklan/ad network dari reader page reference.
- Exact clone spacing/warna/pixel; kita ambil prinsip dan pattern saja.'''
s = s.replace(old, new)
old = '''- Setup design tokens/theme dasar: dark-first, mobile-first.'''
new = '''- Setup design tokens/theme dasar: dark-first, mobile-first, clean utilitarian; referensi visual comix.to v0.3.1.'''
s = s.replace(old, new)
old = '''- Dark-first.
- Content width nyaman di mobile dan desktop.
- Tidak terlalu banyak chrome/navigation saat membaca.'''
new = '''- Dark-first dengan charcoal/near-black reader surface.
- Content width nyaman di mobile dan desktop: full-width mobile, centered strip desktop.
- Tidak terlalu banyak chrome/navigation saat membaca.'''
s = s.replace(old, new)
old = '''- Benchmark comix.to dipakai untuk pattern, bukan visual clone 1:1. (locked #13)'''
new = '''- Benchmark comix.to dipakai untuk pattern, bukan visual clone 1:1. (locked #13)
- Poster-dominant cards + compact metadata cocok untuk discovery.
- Detail page perlu CTA baca yang jelas, chips metadata, dan chapter list cepat discan.
- Hindari ad-network/noisy monetization di reader MVP.'''
s = s.replace(old, new)
old = '''**v0.3 sudah lock Reader UX detail + benchmark comix.to sebagai referensi pattern.**

Changelog v0.2 → v0.3:
- Recon pasif comix.to: HTML/meta/initial data/assets/style strings berhasil; browser visual lokal gagal karena Chromium tidak tersedia (`WinError 2`).
- Locked decisions added: #13-#24.'''
new = '''**v0.3.1 menambahkan visual capture comix.to untuk homepage/detail/reader.**

Changelog v0.3 → v0.3.1:
- Chromium Playwright berhasil diinstall dan dipakai render visual.
- Captured: `recon/comix/visual/home-desktop.png`, `home-mobile.png`, `detail-desktop.png`, `detail-mobile.png`, `reader-desktop.png`, `reader-mobile.png`.
- Koreksi catatan lama: visual browser sekarang tersedia; sebelumnya hanya gagal di browser tool bawaan Hermes.
- Visual takeaways ditambahkan ke Section 4.6 dan Section 14.1.

Changelog v0.2 → v0.3:
- Recon pasif comix.to: HTML/meta/initial data/assets/style strings berhasil; visual kemudian dilengkapi di v0.3.1 via Playwright manual.
- Locked decisions added: #13-#24.'''
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
print('updated', len(s.splitlines()))
