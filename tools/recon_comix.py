import json
import re
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import requests

BASE = 'https://comix.to/'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
OUT = Path('recon/comix')
OUT.mkdir(parents=True, exist_ok=True)

s = requests.Session()
s.headers.update({'User-Agent': UA})
r = s.get(BASE, timeout=30)
r.raise_for_status()
html = r.text
(OUT / 'home.html').write_text(html, encoding='utf-8')

meta = {}
for name, content in re.findall(r'<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"', html, flags=re.I):
    meta[name] = unescape(content)

title = re.search(r'<title>(.*?)</title>', html, flags=re.I|re.S)
assets = sorted(set(re.findall(r'(?:href|src)="([^"]+\.(?:js|css)[^"]*)"', html)))
initial_match = re.search(r'<script type="application/json" id="initial-data">(.*?)</script>', html, flags=re.S)
initial = json.loads(unescape(initial_match.group(1))) if initial_match else {}

# Fetch assets
asset_info = []
for a in assets:
    full = urljoin(BASE, a)
    ar = s.get(full, timeout=30)
    asset_path = OUT / re.sub(r'[^a-zA-Z0-9._-]+', '_', a.strip('/'))
    asset_path.write_bytes(ar.content)
    text = ar.text if 'text' in ar.headers.get('content-type','') or a.endswith(('.js','.css')) else ''
    asset_info.append({'url': full, 'status': ar.status_code, 'bytes': len(ar.content), 'file': str(asset_path)})

# Extract from initial data
queries = initial.get('queries', {}) if isinstance(initial, dict) else {}
query_keys = list(queries.keys())[:30]
items = []
for k, v in queries.items():
    if isinstance(v, list):
        for item in v[:5]:
            if isinstance(item, dict):
                items.append({key: item.get(key) for key in ['id','hid','title','slug','type','contentRating','status','year','rating','followCount','bayesianRating','createdAt','updatedAt','last_chapter_at'] if key in item})
    elif isinstance(v, dict):
        items.append({key: v.get(key) for key in ['id','hid','title','slug','type','contentRating','status','year','rating','followCount','bayesianRating','createdAt','updatedAt','last_chapter_at'] if key in v})

# String grep in js/css
all_asset_text = ''
for p in OUT.glob('*'):
    if p.suffix in ['.js', '.css']:
        try:
            all_asset_text += '\n' + p.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            pass
routes = sorted(set(re.findall(r'["\'](/(?:[a-zA-Z0-9][a-zA-Z0-9_-]*)(?:/[a-zA-Z0-9:_.$*?=&#%{}\[\]-]+)*)["\']', all_asset_text)))
api_like = sorted(set(x for x in routes if 'api' in x.lower() or 'ajax' in x.lower() or 'graphql' in x.lower()))
hexes = sorted(set(re.findall(r'#[0-9a-fA-F]{6}', all_asset_text)))
classes = sorted(set(re.findall(r'\.([a-zA-Z][a-zA-Z0-9_-]{2,})[\s\{\.:#\[]', all_asset_text)))[:300]
labels = sorted(set(re.findall(r'["\']([A-Z][A-Za-z0-9 ,/&+-]{3,40})["\']', all_asset_text)))[:200]

summary = {
    'status': r.status_code,
    'title': unescape(title.group(1)) if title else None,
    'meta': meta,
    'assets': asset_info,
    'initial_page': initial.get('page') if isinstance(initial, dict) else None,
    'initial_query_count': len(queries),
    'initial_query_keys_sample': query_keys,
    'item_samples': items[:30],
    'routes_sample': routes[:200],
    'api_like_routes': api_like[:100],
    'hex_colors': hexes[:100],
    'class_sample': classes[:200],
    'label_sample': labels[:120],
}
(OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False, indent=2)[:12000])
