from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote, urlencode, urljoin

from ..__init__ import Scraper, SourceConfig, SourceError


class MadaraScraper(Scraper):
    """WordPress Madara theme scraper used by Asura Scans, MangaPill, Weeb Central, etc."""

    manga_path: str = "/manga"

    def search(self, query: str) -> dict[str, Any]:
        if not query.strip():
            return {"results": []}
        html_text = self.fetch_text(f"/?s={quote(query)}&post_type=wp-manga")
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
        reader = self._extract_block(html_text, r'<div[^>]+class=["\'][^"\']*reading-content[^"\']*["\'][^>]*>', "</div>") or html_text
        images = self._image_urls(reader)
        if not images:
            raise SourceError("chapter pages not found", status=404)
        return {"pages": [{"pageNumber": idx + 1, "imageUrl": image} for idx, image in enumerate(images)]}

    def _parse_search_results(self, html_text: str) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        for block in re.findall(r'<div[^>]+class=["\'][^"\']*c-tabs-item__content[^"\']*["\'][^>]*>(.*?)</div>\s*</div>\s*</div>', html_text, flags=re.S | re.I):
            title_tag = re.search(r'<h3[^>]*>.*?<a[^>]*>(.*?)</a>', block, flags=re.S | re.I)
            title = self._text(title_tag.group(1)) if title_tag else ""
            href = self._attr(block, "href")
            covers = self._image_urls(block)
            slug = self._slug_from_url(href)
            if slug and title:
                results.append({"id": slug, "title": title, "url": self._abs_url(href), "coverUrl": covers[0] if covers else ""})
        if not results:
            results = self._fallback_search(html_text)
        return results

    def _fallback_search(self, html_text: str) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        for block in re.findall(r'<div[^>]+class=["\'][^"\']*manga-blog[^"\']*["\'][^>]*>(.*?)</div>\s*</div>\s*</div>', html_text, flags=re.S | re.I):
            title_tag = re.search(r'<a[^>]+class=["\'][^"\']*post-title[^"\']*["\'][^>]*>(.*?)</a>', block, flags=re.S | re.I) or re.search(r'<h[34][^>]*>.*?<a[^>]*>(.*?)</a>', block, flags=re.S | re.I)
            title = self._text(title_tag.group(1)) if title_tag else ""
            href = re.search(r'href=["\']([^"\']+)["\']', block, flags=re.I)
            cover = self._image_urls(block)
            slug = self._slug_from_url(href.group(1)) if href else ""
            if slug and title:
                results.append({"id": slug, "title": title, "url": self._abs_url(href.group(1)), "coverUrl": cover[0] if cover else ""})
        return results

    def _parse_detail(self, series_id: str, html_text: str) -> dict[str, Any]:
        title = self._text(self._extract_tag(html_text, "div", "post-title")) or self._title_from_head(html_text) or series_id
        cover = self._extract_tag(html_text, "div", "summary_image") or self._extract_tag(html_text, "div", "thumb") or html_text
        covers = self._image_urls(cover)
        synopsis = self._text(self._extract_tag(html_text, "div", "summary__content")) or self._text(self._extract_tag(html_text, "div", "description-summary"))
        genres = [self._text(match) for match in re.findall(r'<(?:a|span)[^>]+class=["\'][^"\']*(?:genre|genres)[^"\']*["\'][^>]*>(.*?)</(?:a|span)>', html_text, flags=re.S | re.I)]
        if not genres:
            genre_match = re.search(r'<div[^>]+class=["\'][^"\']*genres-content[^"\']*["\'][^>]*>(.*?)</div>', html_text, flags=re.S | re.I)
            genres = [self._text(g) for g in re.findall(r'<a[^>]*>(.*?)</a>', genre_match.group(1))] if genre_match else []
        return {
            "id": series_id,
            "title": title,
            "url": f"{self.config.base_url.rstrip('/')}{self.manga_path}/{series_id}/",
            "coverUrl": covers[0] if covers else "",
            "synopsis": synopsis,
            "type": self._detect_type(html_text),
            "status": self._detect_status(html_text),
            "authorName": self._info_value(html_text, ["Author", "Pengarang"]),
            "artistName": self._info_value(html_text, ["Artist", "Artis"]),
            "releaseYear": self._year(self._info_value(html_text, ["Released", "Year"])) or 1900,
            "genres": genres[:12],
        }

    def _parse_chapters(self, series_id: str, html_text: str) -> list[dict[str, Any]]:
        chapters: list[dict[str, Any]] = []
        for block in re.findall(r'<li[^>]+class=["\'][^"\']*wp-manga-chapter[^"\']*["\'][^>]*>(.*?)</li>', html_text, flags=re.S | re.I):
            href = re.search(r'href=["\']([^"\']+)["\']', block, flags=re.I)
            if not href:
                continue
            chapter_url = href.group(1)
            chapter_name = self._text(re.sub(r'<span[^>]*>.*?</span>', '', block))
            slug = self._chapter_slug_from_url(chapter_url)
            number_match = re.search(r'(?:chapter|ch|vol\s*\d+\s*ch)\s*(\d+(?:\.\d+)?)', chapter_name, flags=re.I)
            raw_num = number_match.group(1) if number_match else "0"
            date_text = self._text(self._extract_tag(block, "span", "chapter-release-date") or self._extract_tag(block, "i", ""))
            chapters.append({
                "id": f"{series_id}-{slug}",
                "slug": slug,
                "numberLabel": chapter_name,
                "numberSort": self._number(raw_num),
                "title": "",
                "publishedAt": self._date_from_text(date_text) if date_text else None,
                "sourceChapterId": slug,
            })
        return chapters

    def _chapter_url(self, series_id: str, chapter_slug: str) -> str:
        return f"{self.config.base_url.rstrip('/')}{self.manga_path}/{series_id}/{chapter_slug}/"

    def _chapter_slug_from_url(self, url: str) -> str:
        parts = [p for p in url.rstrip("/").split("/") if p]
        return parts[-1] if parts else ""

    def _title_from_head(self, html_text: str) -> str:
        match = re.search(r"<title>(.*?)</title>", html_text, flags=re.S | re.I)
        return self._text(match.group(1)).split(" - ")[0] if match else ""

    def _info_value(self, html_text: str, labels: list[str]) -> str:
        for label in labels:
            pattern = rf'<div[^>]+class=["\'][^"\']*post-content_item[^"\']*["\'][^>]*>.*?<h5[^>]*>\s*{re.escape(label)}\s*</h5>.*?<div[^>]+class=["\'][^"\']*summary-content[^"\']*["\'][^>]*>(.*?)</div>'
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
