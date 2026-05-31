import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('recon/comix/visual')
OUT.mkdir(parents=True, exist_ok=True)
URLS = {
    'home': 'https://comix.to/',
}
VIEWPORTS = {
    'mobile': {'width': 390, 'height': 844, 'device_scale_factor': 2, 'is_mobile': True},
    'desktop': {'width': 1440, 'height': 900, 'device_scale_factor': 1, 'is_mobile': False},
}

async def safe_click(page, selector):
    try:
        loc = page.locator(selector).first
        if await loc.count():
            await loc.click(timeout=1500)
            return True
    except Exception:
        pass
    return False

async def capture_one(browser, name, url, vp_name, vp):
    ctx = await browser.new_context(
        viewport={'width': vp['width'], 'height': vp['height']},
        device_scale_factor=vp['device_scale_factor'],
        is_mobile=vp['is_mobile'],
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    )
    page = await ctx.new_page()
    await page.goto(url, wait_until='networkidle', timeout=70000)
    await page.wait_for_timeout(3000)
    await safe_click(page, 'button:has-text("Accept")')
    await safe_click(page, 'button:has-text("I Agree")')
    await page.keyboard.press('Escape')
    await page.screenshot(path=str(OUT / f'{name}-{vp_name}.png'), full_page=True)
    html = await page.content()
    (OUT / f'{name}-{vp_name}.html').write_text(html, encoding='utf-8')
    dump = await page.evaluate('''() => {
      const styleOf = (el) => el && {
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 500),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220),
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
      const qs = (s,n=8) => Array.from(document.querySelectorAll(s)).slice(0,n).map(styleOf).filter(Boolean);
      const all = Array.from(document.querySelectorAll('*')).slice(0, 2500);
      const classFreq = {};
      for (const e of all) {
        const c = e.className && e.className.toString ? e.className.toString() : '';
        for (const t of c.split(/\s+/).filter(Boolean)) classFreq[t] = (classFreq[t]||0)+1;
      }
      return {
        title: document.title,
        url: location.href,
        body: styleOf(document.body),
        header: qs('header, nav, [class*=header], [class*=nav]', 12),
        mainSections: qs('main, section, [class*=section], [class*=home], [class*=hero], [class*=layout]', 30),
        cards: qs('[class*=card], article, a[href*="/comic"], a[href*="/manga"], a[href*="/title"]', 24),
        buttons: qs('button, a[class*=btn], [class*=button]', 20),
        inputs: qs('input, select, [class*=search], [class*=filter]', 20),
        footer: qs('footer', 3),
        headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0,40).map(e => ({tag:e.tagName.toLowerCase(), text:(e.textContent||'').replace(/\s+/g,' ').trim(), cls:(e.className&&e.className.toString?e.className.toString():'')})),
        links: Array.from(document.querySelectorAll('a[href]')).slice(0,100).map(e => ({text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,80), href:e.getAttribute('href'), cls:(e.className&&e.className.toString?e.className.toString():'').slice(0,120)})),
        classFreq: Object.entries(classFreq).sort((a,b)=>b[1]-a[1]).slice(0,120),
      };
    }''')
    (OUT / f'{name}-{vp_name}-styles.json').write_text(json.dumps(dump, ensure_ascii=False, indent=2), encoding='utf-8')
    await ctx.close()
    return dump

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        results = {}
        for name, url in URLS.items():
            for vp_name, vp in VIEWPORTS.items():
                print('capture', name, vp_name, url)
                try:
                    results[f'{name}-{vp_name}'] = await capture_one(browser, name, url, vp_name, vp)
                except Exception as e:
                    results[f'{name}-{vp_name}'] = {'error': repr(e)}
                    print('ERROR', name, vp_name, repr(e))
        await browser.close()
        (OUT / 'visual-summary.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({k: {'title': v.get('title'), 'url': v.get('url'), 'error': v.get('error'), 'headings': v.get('headings', [])[:8]} for k,v in results.items()}, ensure_ascii=False, indent=2))

asyncio.run(main())
