"""KomikCast adapter — JSON API backend."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urlencode

from ..__init__ import Scraper, SourceConfig, SourceError


class KomikCastScraper(Scraper):
    api_url = "https://be.komikcast.cc"

    def search(self, query: str) -> dict[str, Any]:
        if not query.strip():
            return {"results": []}
        params = {"includeMeta": "true", "take": "12", "page": "1", "filter": f'title=like="{query}",nativeTitle=like="{query}"'}
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
        return {"series": {"slug": series_id, "title": detail["title"], "altTitles": [], "synopsis": detail.get("synopsis", ""), "coverUrl": detail.get("coverUrl", ""), "type": detail.get("type", "manga"), "status": detail.get("status", "unknown"), "contentRating": "teen", "demographic": "general", "authorName": detail.get("authorName", ""), "artistName": detail.get("artistName", ""), "releaseYear": detail.get("releaseYear"), "genres": detail.get("genres", []), "featured": False, "sourceSeriesId": series_id, "sourceUrl": detail["url"]}, "chapters": [{"slug": c["slug"], "numberLabel": c["numberLabel"], "numberSort": c["numberSort"], "title": c["title"], "publishedAt": c["publishedAt"], "sourceChapterId": c["sourceChapterId"]} for c in detail["chapters"]]}

    def pages(self, series_id: str, chapter_slug: str) -> dict[str, Any]:
        payload = self.fetch_json(f"{self.api_url}/series/{quote(series_id)}/chapters/{quote(chapter_slug)}")
        item = payload.get("data")
        data = item.get("data", {}) if isinstance(item, dict) else {}
        images = data.get("images") if isinstance(data, dict) else None
        if not isinstance(images, list):
            raise SourceError("chapter pages not found", status=404)
        return {"pages": [{"pageNumber": idx + 1, "imageUrl": img} for idx, img in enumerate(images) if isinstance(img, str)]}

    def _chapters(self, series_id: str) -> list[dict[str, Any]]:
        payload = self.fetch_json(f"{self.api_url}/series/{quote(series_id)}/chapters")
        chapters = payload.get("data", [])
        if not isinstance(chapters, list):
            return []
        return [self._chapter_result(series_id, item) for item in chapters if isinstance(item, dict)]

    def _series_result(self, item: dict) -> dict[str, str]:
        data = item.get("data", {}) if isinstance(item.get("data"), dict) else {}
        slug = data.get("slug") or str(item.get("id", ""))
        return {"id": slug, "title": str(data.get("title") or slug), "url": f"{self.config.base_url.rstrip('/')}/series/{slug}", "coverUrl": data.get("coverImage") or ""}

    def _series_detail(self, item: dict) -> dict[str, Any]:
        data = item.get("data", {}) if isinstance(item.get("data"), dict) else {}
        result = self._series_result(item)
        result.update({"synopsis": data.get("synopsis") or "", "type": "manga", "status": self._status(data.get("status")), "authorName": data.get("author") or "", "artistName": "", "releaseYear": self._year(data.get("releaseYear") or data.get("releaseDate") or data.get("year")) or 1900, "genres": self._genres(data.get("genres"))})
        return result

    def _chapter_result(self, series_id: str, item: dict) -> dict[str, Any]:
        data = item.get("data", {}) if isinstance(item.get("data"), dict) else {}
        index = data.get("index") or item.get("chapterIndex") or 0
        slug = self._format_chapter_index(index)
        title = data.get("title") or ""
        return {"id": f"{series_id}-{slug}", "slug": slug, "numberLabel": f"Chapter {slug}", "numberSort": self._number(index), "title": title, "publishedAt": self._date(item.get("createdAt") or item.get("updatedAt")), "sourceChapterId": slug}

    @staticmethod
    def _genres(genres: Any) -> list[str]:
        if not isinstance(genres, list):
            return []
        return [genre.get("data", {}).get("name", "") for genre in genres if isinstance(genre.get("data", {}).get("name"), str)]

    @staticmethod
    def _status(status: Any) -> str:
        text = str(status or "").lower()
        if text in {"ongoing", "on going"}: return "ongoing"
        if text in {"completed", "complete"}: return "completed"
        if text == "hiatus": return "hiatus"
        if text in {"cancelled", "canceled"}: return "cancelled"
        return "unknown"

    @staticmethod
    def _date(value: Any) -> str | None:
        if not isinstance(value, str) or not value: return None
        try: return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError: return None


def create_scraper(config: SourceConfig) -> KomikCastScraper:
    return KomikCastScraper(config)
