import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('recon/comix/visual')
OUT.mkdir(parents=True, exist_ok=True)
DETAIL_URL = 'https://comix.to/title/l7re-anyone-can-beat-the-original'
VIEWPORTS = {
    'mobile': {'width': 390, 'height': 844, 'device_scale_factor': 2, 'is_mobile': True},
    'desktop': {'width': 1440, 'height': 900, 'device_scale_factor': 1, 'is_mobile': False},
}

async def dump_page(page, name, vp_name):
    await page.wait_for_timeout(2500)
    await page.keyboard.press('Escape')
    await page.screenshot(path=str(OUT / f'{name}-{vp_name}.png'), full_page=True)
    (OUT / f'{name}-{vp_name}.html').write_text(await page.content(), encoding='utf-8')
    dump = await page.evaluate(r'''() => {
      const styleOf = (el) => el && {
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 500),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260),
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
        font: getComputedStyle(el).fontFamily,
        fs: getComputedStyle(el).fontSize,
        fw: getComputedStyle(el).fontWeight,
        radius: getComputedStyle(el).borderRadius,
        shadow: getComputedStyle(el).boxShadow.slice(0, 200),
        display: getComputedStyle(el).display,
        pos: getComputedStyle(el).position,
        gap: getComputedStyle(el).gap,
        gridCols: getComputedStyle(el).gridTemplateColumns,
        rect: (() => { const r = el.getBoundingClientRect(); return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)} })()
      };
      const qs = (s,n=20) => Array.from(document.querySelectorAll(s)).slice(0,n).map(styleOf).filter(Boolean);
      return {
        title: document.title,
        url: location.href,
        body: styleOf(document.body),
        header: qs('header, nav, [class*=topnav], [class*=reader], [class*=nav]', 20),
        main: qs('main, section, [class*=title], [class*=chapter], [class*=reader], [class*=page], [class*=layout], [class*=detail], [class*=info]', 60),
        headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0,60).map(e => ({tag:e.tagName.toLowerCase(), text:(e.textContent||'').replace(/\s+/g,' ').trim(), cls:(e.className&&e.className.toString?e.className.toString():'')})),
        links: Array.from(document.querySelectorAll('a[href]')).slice(0,180).map(e => ({text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,100), href:e.href, raw:e.getAttribute('href'), cls:(e.className&&e.className.toString?e.className.toString():'').slice(0,160)})),
        buttons: qs('button, a[class*=btn], [role=button]', 60),
        images: Array.from(document.querySelectorAll('img')).slice(0,80).map(img => ({alt:img.alt, src:img.currentSrc || img.src, cls:(img.className&&img.className.toString?img.className.toString():'').slice(0,120), rect:(()=>{const r=img.getBoundingClientRect(); return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)}})()})),
      };
    }''')
    (OUT / f'{name}-{vp_name}-styles.json').write_text(json.dumps(dump, ensure_ascii=False, indent=2), encoding='utf-8')
    return dump

async def capture_url(browser, name, url, vp_name, vp):
    ctx = await browser.new_context(
        viewport={'width': vp['width'], 'height': vp['height']},
        device_scale_factor=vp['device_scale_factor'],
        is_mobile=vp['is_mobile'],
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    )
    page = await ctx.new_page()
    await page.goto(url, wait_until='networkidle', timeout=70000)
    dump = await dump_page(page, name, vp_name)
    await ctx.close()
    return dump

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        results = {}
        # detail captures
        for vp_name, vp in VIEWPORTS.items():
            print('capture detail', vp_name)
            results[f'detail-{vp_name}'] = await capture_url(browser, 'detail', DETAIL_URL, vp_name, vp)
        # discover chapter from desktop detail dump
        links = results['detail-desktop'].get('links', [])
        chapter_candidates = [l for l in links if re.search(r'/(chapter|read|title)/', l.get('raw') or '') and ('chapter' in (l.get('text','').lower()+l.get('raw','').lower()))]
        if not chapter_candidates:
            chapter_candidates = [l for l in links if 'chapter' in (l.get('text','').lower())]
        if not chapter_candidates:
            chapter_candidates = [l for l in links if '/title/' in (l.get('raw') or '') and l.get('raw') != '/title/l7re-anyone-can-beat-the-original']
        (OUT/'chapter-candidates.json').write_text(json.dumps(chapter_candidates[:50], ensure_ascii=False, indent=2), encoding='utf-8')
        print('chapter candidates', json.dumps(chapter_candidates[:10], ensure_ascii=False, indent=2))
        reader_url = None
        if chapter_candidates:
            reader_url = chapter_candidates[0]['href']
            for vp_name, vp in VIEWPORTS.items():
                print('capture reader', vp_name, reader_url)
                try:
                    results[f'reader-{vp_name}'] = await capture_url(browser, 'reader', reader_url, vp_name, vp)
                except Exception as e:
                    results[f'reader-{vp_name}'] = {'error': repr(e), 'url': reader_url}
        results['reader_url'] = reader_url
        await browser.close()
        (OUT/'detail-reader-summary.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({k: {'title': v.get('title') if isinstance(v,dict) else None, 'url': v.get('url') if isinstance(v,dict) else v, 'error': v.get('error') if isinstance(v,dict) else None, 'headings': v.get('headings', [])[:8] if isinstance(v,dict) else None} for k,v in results.items()}, ensure_ascii=False, indent=2))

asyncio.run(main())
