#!/usr/bin/env python
"""Scaffold for a real JSON HTTP source service.

This file is intentionally separate from the Go API. Fill in the parser methods
for one target source, run it locally, then point Gomic at it with SOURCE_URL.

The default `fixture` mode returns deterministic data so the service can be
smoke-tested before a real target is wired.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone
from urllib.parse import parse_qs, quote, unquote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
import re


@dataclass(frozen=True)
class SourceConfig:
    base_url: str
    user_agent: str
    referer: str
    request_delay: float
    timeout: float


class SourceError(RuntimeError):
    def __init__(self, message: str, status: int = 500) -> None:
        super().__init__(message)
        self.status = status


class Scraper:
    """Parser seam for a real source.

    Replace the methods in this class for the target site. Keep output shapes
    matching docs/source-service-contract.md.
    """

    def __init__(self, config: SourceConfig) -> None:
        self.config = config
        self.last_request_at = 0.0

    def search(self, query: str) -> dict[str, Any]:
        # Example shape for a real implementation:
        # html = self.fetch_text("/search?" + urlencode({"q": query}))
        # results = parse_search_html(html)
        # return {"results": results}
        if not query.strip():
            return {"results": []}
        raise SourceError("real search parser is not implemented", status=501)

    def detail(self, series_id: str) -> dict[str, Any]:
        # html = self.fetch_text(f"/series/{quote(series_id)}")
        # return parse_series_detail_html(html)
        raise SourceError(f"real detail parser is not implemented for {series_id}", status=501)

    def import_series(self, series_id: str) -> dict[str, Any]:
        # Usually calls detail(), then chapter list parser, and maps fields into
        # the Gomic import payload.
        raise SourceError(f"real import parser is not implemented for {series_id}", status=501)

    def pages(self, series_id: str, chapter_slug: str) -> dict[str, Any]:
        # html = self.fetch_text(f"/series/{quote(series_id)}/{quote(chapter_slug)}")
        # return {"pages": parse_page_images(html)}
        raise SourceError(f"real page parser is not implemented for {series_id}/{chapter_slug}", status=501)

    def fetch_text(self, path_or_url: str, accept: str = "text/html,application/xhtml+xml") -> str:
        """Fetch upstream content with simple throttling and configurable headers."""
        if not self.config.base_url and not path_or_url.startswith(("http://", "https://")):
            raise SourceError("SOURCE_BASE_URL is required for relative upstream paths", status=500)

        now = time.monotonic()
        wait_for = self.config.request_delay - (now - self.last_request_at)
        if wait_for > 0:
            time.sleep(wait_for)

        url = path_or_url if path_or_url.startswith(("http://", "https://")) else urljoin(self.config.base_url.rstrip("/") + "/", path_or_url.lstrip("/"))
        headers = {"User-Agent": self.config.user_agent, "Accept": accept}
        if self.config.referer:
            headers["Referer"] = self.config.referer

        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=self.config.timeout) as response:  # noqa: S310 - operator-controlled scraper target
                self.last_request_at = time.monotonic()
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")
        except HTTPError as error:
            raise SourceError(f"upstream returned HTTP {error.code}: {url}", status=502) from error
        except URLError as error:
            raise SourceError(f"upstream request failed: {error.reason}", status=502) from error

    def fetch_json(self, path_or_url: str) -> dict[str, Any]:
        try:
            payload = json.loads(self.fetch_text(path_or_url, accept="application/json"))
        except json.JSONDecodeError as error:
            raise SourceError("upstream returned invalid JSON", status=502) from error
        if not isinstance(payload, dict):
            raise SourceError("upstream returned unexpected JSON shape", status=502)
        return payload


class KomikCastScraper(Scraper):
    """Komik Cast adapter based on the Mihon/Tachiyomi extension API calls."""

    api_url = "https://be.komikcast.cc"

    def search(self, query: str) -> dict[str, Any]:
        if not query.strip():
            return {"results": []}
        params = {
            "includeMeta": "true",
            "take": "12",
            "page": "1",
            "filter": f'title=like="{query}",nativeTitle=like="{query}"',
        }
        payload = self.fetch_json(f"{self.api_url}/series?{urlencode(params)}")
        return {"results": [self._series_result(item) for item in payload.get("data", [])]}

    def detail(self, series_id: str) -> dict[str, Any]:
        payload = self.fetch_json(f"{self.api_url}/series/{quote(series_id)}")
        item = payload.get("data")
        if not isinstance(item, dict):
            raise SourceError("series not found", status=404)
        result = self._series_detail(item)
        result["chapters"] = self._chapters(series_id)
        result["chapterCount"] = len(result["chapters"])
        return result

    def import_series(self, series_id: str) -> dict[str, Any]:
        detail = self.detail(series_id)
        return {
            "series": {
                "slug": series_id,
                "title": detail["title"],
                "altTitles": [],
                "synopsis": detail.get("synopsis", ""),
                "coverUrl": detail.get("coverUrl", ""),
                "type": detail.get("type", "manga"),
                "status": detail.get("status", "unknown"),
                "contentRating": "teen",
                "demographic": "general",
                "authorName": detail.get("authorName", ""),
                "artistName": detail.get("artistName", ""),
                "releaseYear": detail.get("releaseYear"),
                "genres": detail.get("genres", []),
                "featured": False,
                "sourceSeriesId": series_id,
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

    def pages(self, series_id: str, chapter_slug: str) -> dict[str, Any]:
        payload = self.fetch_json(f"{self.api_url}/series/{quote(series_id)}/chapters/{quote(chapter_slug)}")
        item = payload.get("data")
        data = item.get("data", {}) if isinstance(item, dict) else {}
        images = data.get("images") if isinstance(data, dict) else None
        if not isinstance(images, list):
            raise SourceError("chapter pages not found", status=404)
        return {"pages": [{"pageNumber": idx + 1, "imageUrl": image} for idx, image in enumerate(images) if isinstance(image, str)]}

    def _chapters(self, series_id: str) -> list[dict[str, Any]]:
        payload = self.fetch_json(f"{self.api_url}/series/{quote(series_id)}/chapters")
        chapters = payload.get("data", [])
        if not isinstance(chapters, list):
            return []
        return [self._chapter_result(series_id, item) for item in chapters if isinstance(item, dict)]

    def _series_result(self, item: dict[str, Any]) -> dict[str, str]:
        data = item.get("data", {}) if isinstance(item.get("data"), dict) else {}
        slug = data.get("slug") or str(item.get("id", ""))
        return {
            "id": slug,
            "title": str(data.get("title") or slug),
            "url": f"{self.config.base_url.rstrip('/')}/series/{slug}",
            "coverUrl": data.get("coverImage") or "",
        }

    def _series_detail(self, item: dict[str, Any]) -> dict[str, Any]:
        data = item.get("data", {}) if isinstance(item.get("data"), dict) else {}
        result = self._series_result(item)
        result.update(
            {
                "synopsis": data.get("synopsis") or "",
                "type": "manga",
                "status": self._status(data.get("status")),
                "authorName": data.get("author") or "",
                "artistName": "",
                "releaseYear": self._year(data.get("releaseYear") or data.get("releaseDate") or data.get("year")) or 1900,
                "genres": self._genres(data.get("genres")),
            }
        )
        return result

    def _chapter_result(self, series_id: str, item: dict[str, Any]) -> dict[str, Any]:
        data = item.get("data", {}) if isinstance(item.get("data"), dict) else {}
        index = data.get("index") or item.get("chapterIndex") or 0
        slug = self._format_chapter_index(index)
        title = data.get("title") or ""
        return {
            "id": f"{series_id}-{slug}",
            "slug": slug,
            "numberLabel": f"Chapter {slug}",
            "numberSort": self._number(index),
            "title": title,
            "publishedAt": self._date(item.get("createdAt") or item.get("updatedAt")),
            "sourceChapterId": slug,
        }

    @staticmethod
    def _genres(genres: Any) -> list[str]:
        if not isinstance(genres, list):
            return []
        names = []
        for genre in genres:
            data = genre.get("data", {}) if isinstance(genre, dict) else {}
            if isinstance(data.get("name"), str):
                names.append(data["name"])
        return names

    @staticmethod
    def _status(status: Any) -> str:
        text = str(status or "").lower()
        if text in {"ongoing", "on going"}:
            return "ongoing"
        if text in {"completed", "complete"}:
            return "completed"
        if text == "hiatus":
            return "hiatus"
        if text in {"cancelled", "canceled"}:
            return "cancelled"
        return "unknown"

    @staticmethod
    def _number(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @classmethod
    def _format_chapter_index(cls, value: Any) -> str:
        number = cls._number(value)
        return str(int(number)) if number.is_integer() else (f"{number:.2f}".rstrip("0").rstrip("."))

    @staticmethod
    def _date(value: Any) -> str | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _year(value: Any) -> int | None:
        match = re.search(r"\d{4}", str(value or ""))
        return int(match.group(0)) if match else None


class MangaThemesiaScraper(Scraper):
    """Generic MangaThemesia/WP Manga scraper used by KomikIndo-like sites."""

    manga_path = "/manga"

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
        return {
            "series": {
                "slug": series_id,
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
                "sourceSeriesId": series_id,
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
            slug = self._series_slug_from_url(href)
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
            "type": self._type(html_text),
            "status": self._status(html_text),
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
        if chapter_slug.endswith("bahasa-indonesia"):
            return f"{self.config.base_url.rstrip('/')}/{chapter_slug}/"
        return f"{self.config.base_url.rstrip('/')}/{series_id}-chapter-{chapter_slug}-bahasa-indonesia/"

    def _chapter_slug_from_url(self, series_id: str, url: str) -> str:
        return urlparse(url).path.strip("/")

    def _series_slug_from_url(self, url: str) -> str:
        parts = [part for part in urlparse(url).path.split("/") if part]
        return parts[-1] if parts else ""

    def _abs_url(self, url: str) -> str:
        return urljoin(self.config.base_url.rstrip("/") + "/", url)

    @staticmethod
    def _attr(html_text: str, attr: str) -> str:
        match = re.search(rf'{attr}=["\']([^"\']+)["\']', html_text, flags=re.I)
        return html.unescape(match.group(1)) if match else ""

    @staticmethod
    def _extract_tag(html_text: str, tag: str, class_name: str) -> str:
        match = re.search(rf'<{tag}[^>]+class=["\'][^"\']*{re.escape(class_name)}[^"\']*["\'][^>]*>(.*?)</{tag}>', html_text, flags=re.S | re.I)
        return match.group(1) if match else ""

    @staticmethod
    def _extract_block(html_text: str, opening_pattern: str, closing: str) -> str:
        start = re.search(opening_pattern, html_text, flags=re.I)
        if not start:
            return ""
        end = html_text.find(closing, start.end())
        return html_text[start.end(): end if end != -1 else len(html_text)]

    @staticmethod
    def _text(fragment: str) -> str:
        cleaned = re.sub(r"<[^>]+>", " ", fragment or "")
        return re.sub(r"\s+", " ", html.unescape(cleaned)).strip()

    @staticmethod
    def _image_urls(fragment: str) -> list[str]:
        urls = []
        for match in re.finditer(r'<img[^>]+(?:src|data-src|data-lazy-src)=["\']([^"\']+)["\']', fragment, flags=re.I):
            url = html.unescape(match.group(1)).strip()
            if url and not url.startswith("data:") and url not in urls:
                urls.append(url)
        return urls

    @staticmethod
    def _title_from_head(html_text: str) -> str:
        match = re.search(r"<title>(.*?)</title>", html_text, flags=re.S | re.I)
        return MangaThemesiaScraper._text(match.group(1)).split(" - ")[0] if match else ""

    @staticmethod
    def _info_value(html_text: str, labels: list[str]) -> str:
        for label in labels:
            patterns = [
                rf'<(?:b|span)[^>]*>\s*{re.escape(label)}\s*:?\s*</(?:b|span)>\s*<[^>]+>(.*?)</[^>]+>',
                rf'<div[^>]+class=["\'][^"\']*imptdt[^"\']*["\'][^>]*>\s*{re.escape(label)}\s*:?\s*<i[^>]*>(.*?)</i>',
            ]
            for pattern in patterns:
                match = re.search(pattern, html_text, flags=re.S | re.I)
                if match:
                    return MangaThemesiaScraper._text(match.group(1))
        return ""

    @staticmethod
    def _type(html_text: str) -> str:
        text = html_text.lower()
        if "manhwa" in text:
            return "manhwa"
        if "manhua" in text:
            return "manhua"
        return "manga"

    @staticmethod
    def _status(html_text: str) -> str:
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

    @staticmethod
    def _number(value: Any) -> float:
        match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
        return float(match.group(0)) if match else 0.0

    @staticmethod
    def _format_chapter_index(value: Any) -> str:
        number = MangaThemesiaScraper._number(value)
        return str(int(number)) if number.is_integer() else f"{number:g}"

    @staticmethod
    def _date_from_text(value: str) -> str | None:
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                parsed = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
                return parsed.isoformat().replace("+00:00", "Z")
            except ValueError:
                pass
        return None

    @staticmethod
    def _year(value: Any) -> int | None:
        match = re.search(r"\d{4}", str(value or ""))
        return int(match.group(0)) if match else None


class KomikIndoScraper(MangaThemesiaScraper):
    """KomikIndo adapter for the MangaThemesia WordPress layout."""


class FixtureScraper(Scraper):
    """Deterministic implementation that proves the service contract works."""

    series_id = "fixture-scraper-series"
    series_slug = "fixture-scraper-signal"

    chapters = [
        {
            "id": "fixture-001",
            "slug": "chapter-001",
            "numberLabel": "Chapter 1",
            "numberSort": 1,
            "title": "Fixture Handshake",
            "publishedAt": "2026-02-01T00:00:00Z",
            "sourceChapterId": "fixture-001",
        },
        {
            "id": "fixture-002",
            "slug": "chapter-002",
            "numberLabel": "Chapter 2",
            "numberSort": 2,
            "title": "Parser Window",
            "publishedAt": "2026-02-08T00:00:00Z",
            "sourceChapterId": "fixture-002",
        },
    ]

    def search(self, query: str) -> dict[str, Any]:
        if query.strip() and query.lower() not in "fixture scraper signal":
            return {"results": []}
        return {"results": [self._result()]}

    def detail(self, series_id: str) -> dict[str, Any]:
        self._require_series(series_id)
        return {
            **self._result(),
            "synopsis": "Fixture data for the scraper service scaffold.",
            "type": "manhwa",
            "status": "ongoing",
            "authorName": "Scaffold Author",
            "artistName": "Parser Artist",
            "releaseYear": 2026,
            "genres": ["Action", "Sci-Fi"],
            "chapterCount": len(self.chapters),
            "chapters": self.chapters,
        }

    def import_series(self, series_id: str) -> dict[str, Any]:
        detail = self.detail(series_id)
        return {
            "series": {
                "slug": self.series_slug,
                "title": detail["title"],
                "altTitles": ["Fixture Signal"],
                "synopsis": detail["synopsis"],
                "coverUrl": detail["coverUrl"],
                "type": detail["type"],
                "status": detail["status"],
                "contentRating": "teen",
                "demographic": "general",
                "authorName": detail["authorName"],
                "artistName": detail["artistName"],
                "releaseYear": detail["releaseYear"],
                "genres": detail["genres"],
                "featured": False,
                "sourceSeriesId": self.series_id,
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
                for chapter in self.chapters
            ],
        }

    def pages(self, series_id: str, chapter_slug: str) -> dict[str, Any]:
        self._require_series(series_id)
        pages = {
            "chapter-001": [
                {"pageNumber": 1, "imageUrl": "/mock-pages/nighthawk-002-1.svg", "width": 900, "height": 1280},
                {"pageNumber": 2, "imageUrl": "/mock-pages/nighthawk-002-2.svg", "width": 900, "height": 1280},
            ],
            "chapter-002": [
                {"pageNumber": 1, "imageUrl": "/mock-pages/nighthawk-003-1.svg", "width": 900, "height": 1280},
                {"pageNumber": 2, "imageUrl": "/mock-pages/nighthawk-003-2.svg", "width": 900, "height": 1280},
            ],
        }.get(chapter_slug)
        if pages is None:
            raise SourceError("chapter not found", status=404)
        return {"pages": pages}

    def _result(self) -> dict[str, str]:
        source_url = self.config.base_url.rstrip("/") or "https://source.example"
        return {
            "id": self.series_id,
            "title": "Fixture Scraper Signal",
            "url": f"{source_url}/series/{self.series_id}",
            "coverUrl": "/mock-covers/nighthawk.svg",
        }

    def _require_series(self, series_id: str) -> None:
        if series_id != self.series_id:
            raise SourceError("series not found", status=404)


class Handler(BaseHTTPRequestHandler):
    scraper: Scraper
    server_version = "GomicScraperScaffold/1.0"

    def do_GET(self) -> None:  # noqa: N802 - stdlib hook name
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        try:
            if path == "/healthz":
                self.write_json({"status": "ok", "scraper": self.scraper.__class__.__name__})
                return
            if path == "/search":
                query = parse_qs(parsed.query).get("q", [""])[0]
                self.write_json(self.scraper.search(query))
                return

            parts = [unquote(part) for part in path.strip("/").split("/")]
            if len(parts) == 2 and parts[0] == "series":
                self.write_json(self.scraper.detail(parts[1]))
                return
            if len(parts) == 3 and parts[0] == "series" and parts[2] == "import":
                self.write_json(self.scraper.import_series(parts[1]))
                return
            if len(parts) == 5 and parts[0] == "series" and parts[2] == "chapters" and parts[4] == "pages":
                self.write_json(self.scraper.pages(parts[1], parts[3]))
                return
            raise SourceError("not found", status=404)
        except SourceError as error:
            self.write_json({"error": str(error)}, status=error.status)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def write_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def build_config(args: argparse.Namespace) -> SourceConfig:
    return SourceConfig(
        base_url=args.source_base_url or os.getenv("SOURCE_BASE_URL", ""),
        user_agent=os.getenv("SOURCE_USER_AGENT", "GomicScraperScaffold/1.0"),
        referer=os.getenv("SOURCE_REFERER", ""),
        request_delay=float(os.getenv("SOURCE_REQUEST_DELAY", "0.5")),
        timeout=float(os.getenv("SOURCE_TIMEOUT", "20")),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a scaffold JSON source service for Gomic.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=19190)
    parser.add_argument("--mode", choices=["fixture", "real", "komikcast", "komikindo"], default="fixture")
    parser.add_argument("--source-base-url", default="")
    args = parser.parse_args()

    config = build_config(args)
    if args.mode == "fixture":
        Handler.scraper = FixtureScraper(config)
    elif args.mode == "komikcast":
        if not config.base_url:
            config = SourceConfig(
                base_url="https://v2.komikcast.fit",
                user_agent=config.user_agent,
                referer=config.referer or "https://v2.komikcast.fit/",
                request_delay=config.request_delay,
                timeout=config.timeout,
            )
        Handler.scraper = KomikCastScraper(config)
    elif args.mode == "komikindo":
        if not config.base_url:
            config = SourceConfig(
                base_url="https://komikindo.fit",
                user_agent=config.user_agent,
                referer=config.referer or "https://komikindo.fit/",
                request_delay=config.request_delay,
                timeout=config.timeout,
            )
        Handler.scraper = KomikIndoScraper(config)
    else:
        Handler.scraper = Scraper(config)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Gomic scraper scaffold listening on http://{args.host}:{args.port} ({args.mode})")
    server.serve_forever()


if __name__ == "__main__":
    main()
