import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('recon/comix/visual')
OUT.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        )
        page = await ctx.new_page()
        await page.goto('https://comix.to/', wait_until='networkidle', timeout=70000)
        await page.wait_for_timeout(2500)
        links = await page.evaluate('''() => Array.from(document.querySelectorAll('a[href]')).map(a => ({
            text:(a.textContent||'').replace(/\s+/g,' ').trim().slice(0,160),
            href:a.href,
            raw:a.getAttribute('href'),
            cls:(a.className&&a.className.toString?a.className.toString():'').slice(0,200)
        })).filter(x => x.href.includes('comix.to'))''')
        await browser.close()
        (OUT/'links.json').write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding='utf-8')
        for l in links[:120]:
            print(json.dumps(l, ensure_ascii=False))

asyncio.run(main())
