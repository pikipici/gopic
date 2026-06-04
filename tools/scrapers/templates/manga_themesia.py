from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urlencode, urljoin, urlparse

from ..__init__ import Scraper, SourceConfig, SourceError


class MangaThemesiaScraper(Scraper):
    """WordPress + MangaThemesia theme scraper template."""

    manga_path: str = "/manga"

    def search(self, query: str) -> dict[str, Any]:
        if not query.strip():
            return {"results": []}
        html_text = self.fetch_text(f"{self.manga_path}/?{urlencode({'title': query, 'page': '1'})}")
        return {"results": self._parse_search_results(html_text)[:12]}

    def detail(self, series_id: str) -> dict[str, Any]:
        html_text = self.fetch_text(f"{self.manga_path}/{quote(series_id)}/")
        result = self._parse_detail(series_id, html_text)
        result["chapters"] = self._parse_chapters(series_id, html_text)
        result["chapterCount"] = len(result["chapters"])
        return result

    def import_series(self, series_id: str) -> dict[str, Any]:
        detail = self.detail(series_id)
        return self._build_import_payload(detail)

    def pages(self, series_id: str, chapter_slug: str) -> dict[str, Any]:
        chapter_url = self._chapter_url(series_id, chapter_slug)
        html_text = self.fetch_text(chapter_url)
        reader = self._extract_block(html_text, r'<div[^>]+id=["\']readerarea["\'][^>]*>', "</div>") or html_text
        images = self._image_urls(reader)
        if not images:
            raise SourceError("chapter pages not found", status=404)
        return {"pages": [{"pageNumber": idx + 1, "imageUrl": image} for idx, image in enumerate(images)]}

    def _parse_search_results(self, html_text: str) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        for block in re.findall(r'<div class=["\']bsx["\'][^>]*>(.*?)</a>\s*</div>', html_text, flags=re.S | re.I):
            href = self._attr(block, "href")
            title = self._attr(block, "title") or self._text(self._extract_tag(block, "div", "tt"))
            cover = self._image_urls(block)
            slug = self._slug_from_url(href)
            if slug and title:
                results.append({"id": slug, "title": title, "url": self._abs_url(href), "coverUrl": cover[0] if cover else ""})
        return results

    def _parse_detail(self, series_id: str, html_text: str) -> dict[str, Any]:
        title = self._text(self._extract_tag(html_text, "h1", "entry-title")) or self._title_from_head(html_text) or series_id
        cover_block = self._extract_tag(html_text, "div", "thumb") or self._extract_tag(html_text, "div", "infomanga") or html_text
        covers = self._image_urls(cover_block)
        synopsis = self._text(self._extract_tag(html_text, "div", "entry-content")) or self._text(self._extract_tag(html_text, "div", "desc"))
        genres = [self._text(match) for match in re.findall(r'<(?:div|span)[^>]+class=["\'][^"\']*(?:gnr|mgen)[^"\']*["\'][^>]*>(.*?)</(?:div|span)>', html_text, flags=re.S | re.I)]
        if genres:
            genres = [item for genre in genres for item in [part.strip() for part in genre.split(",")] if item]
        return {
            "id": series_id,
            "title": title,
            "url": f"{self.config.base_url.rstrip('/')}{self.manga_path}/{series_id}/",
            "coverUrl": covers[0] if covers else "",
            "synopsis": synopsis,
            "type": self._detect_type(html_text),
            "status": self._detect_status(html_text),
            "authorName": self._info_value(html_text, ["Author", "Pengarang", "Mangaka"]),
            "artistName": self._info_value(html_text, ["Artist", "Artis", "Ilustrator"]),
            "releaseYear": self._year(self._info_value(html_text, ["Released", "Year", "Tahun"])) or 1900,
            "genres": genres[:12],
        }

    def _parse_chapters(self, series_id: str, html_text: str) -> list[dict[str, Any]]:
        chapters: list[dict[str, Any]] = []
        for block in re.findall(r'<li[^>]*data-num=["\']([^"\']+)["\'][^>]*>(.*?)</li>', html_text, flags=re.S | re.I):
            raw_num, body = block
            href = self._attr(body, "href")
            slug = self._chapter_slug_from_url(series_id, href) or self._format_chapter_index(raw_num)
            title = self._text(self._extract_tag(body, "span", "chapternum")) or f"Chapter {raw_num}"
            chapters.append({
                "id": f"{series_id}-{slug}",
                "slug": slug,
                "numberLabel": title,
                "numberSort": self._number(raw_num),
                "title": "",
                "publishedAt": self._date_from_text(self._text(self._extract_tag(body, "span", "chapterdate"))),
                "sourceChapterId": slug,
            })
        return chapters

    def _chapter_url(self, series_id: str, chapter_slug: str) -> str:
        if chapter_slug.startswith("http"):
            return chapter_slug
        if "chapter" in chapter_slug.lower() or chapter_slug.endswith("bahasa-indonesia"):
            return f"{self.config.base_url.rstrip('/')}/{chapter_slug}/"
        return f"{self.config.base_url.rstrip('/')}/{series_id}-chapter-{chapter_slug}-bahasa-indonesia/"

    def _chapter_slug_from_url(self, series_id: str, url: str) -> str:
        return urlparse(url).path.strip("/")

    def _title_from_head(self, html_text: str) -> str:
        match = re.search(r"<title>(.*?)</title>", html_text, flags=re.S | re.I)
        return self._text(match.group(1)).split(" - ")[0] if match else ""

    def _info_value(self, html_text: str, labels: list[str]) -> str:
        for label in labels:
            patterns = [
                rf'<(?:b|span)[^>]*>\s*{re.escape(label)}\s*:?\s*</(?:b|span)>\s*<[^>]+>(.*?)</[^>]+>',
                rf'<div[^>]+class=["\'][^"\']*imptdt[^"\']*["\'][^>]*>\s*{re.escape(label)}\s*:?\s*<i[^>]*>(.*?)</i>',
            ]
            for pattern in patterns:
                match = re.search(pattern, html_text, flags=re.S | re.I)
                if match:
                    return self._text(match.group(1))
        return ""

    def _detect_type(self, html_text: str) -> str:
        text = html_text.lower()
        if "manhwa" in text:
            return "manhwa"
        if "manhua" in text:
            return "manhua"
        return "manga"

    def _detect_status(self, html_text: str) -> str:
        text = html_text.lower()
        if "completed" in text or "tamat" in text:
            return "completed"
        if "hiatus" in text:
            return "hiatus"
        if "dropped" in text or "cancel" in text:
            return "cancelled"
        if "ongoing" in text or "berjalan" in text:
            return "ongoing"
        return "unknown"

    def _build_import_payload(self, detail: dict[str, Any]) -> dict[str, Any]:
        return {
            "series": {
                "slug": detail["id"],
                "title": detail["title"],
                "altTitles": detail.get("altTitles", []),
                "synopsis": detail.get("synopsis", ""),
                "coverUrl": detail.get("coverUrl", ""),
                "type": detail.get("type", "manga"),
                "status": detail.get("status", "unknown"),
                "contentRating": "teen",
                "demographic": "general",
                "authorName": detail.get("authorName", ""),
                "artistName": detail.get("artistName", ""),
                "releaseYear": detail.get("releaseYear") or 1900,
                "genres": detail.get("genres", []),
                "featured": False,
                "sourceSeriesId": detail["id"],
                "sourceUrl": detail["url"],
            },
            "chapters": [
                {
                    "slug": chapter["slug"],
                    "numberLabel": chapter["numberLabel"],
                    "numberSort": chapter["numberSort"],
                    "title": chapter["title"],
                    "publishedAt": chapter["publishedAt"],
                    "sourceChapterId": chapter["sourceChapterId"],
                }
                for chapter in detail["chapters"]
            ],
        }
