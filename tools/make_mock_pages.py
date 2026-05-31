from pathlib import Path

out = Path('web/public/mock-pages')
out.mkdir(parents=True, exist_ok=True)
combos = [
    ('nighthawk', ['001','002','003'], 4, '#312e81', '#bef264'),
    ('saltwater', ['011','012'], 4, '#0e7490', '#e0f2fe'),
    ('iron-lantern', ['040','041'], 3, '#991b1b', '#fbbf24'),
    ('orbit-cafe', ['023','024'], 4, '#7c3aed', '#f9a8d4'),
]
for series, chapters, max_pages, a, b in combos:
    for chapter in chapters:
        for page in range(1, max_pages + 1):
            path = out / f'{series}-{chapter}-{page}.svg'
            path.write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1280">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{a}"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
  <rect width="900" height="1280" fill="url(#g)"/>
  <rect x="70" y="70" width="760" height="1140" rx="40" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="8"/>
  <circle cx="690" cy="230" r="110" fill="{b}" opacity=".7"/>
  <path d="M120 920 C260 740 390 770 520 610 C620 488 720 420 805 370 V1210 H120 Z" fill="rgba(0,0,0,.38)"/>
  <text x="90" y="170" fill="white" font-family="Arial" font-size="44" font-weight="900">{series.upper()}</text>
  <text x="90" y="236" fill="rgba(255,255,255,.72)" font-family="Arial" font-size="32" font-weight="700">Chapter {chapter} · Page {page}</text>
  <text x="450" y="690" text-anchor="middle" fill="white" font-family="Arial" font-size="118" font-weight="900">{page}</text>
</svg>''', encoding='utf-8')
print('mock pages generated')
