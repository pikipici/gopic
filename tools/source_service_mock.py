#!/usr/bin/env python
"""Small JSON HTTP source service for local Gomic import testing."""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

SERIES_ID = "sample-json-series"
SERIES_URL = f"http://localhost:19090/series/{SERIES_ID}"

CHAPTERS = [
    {
        "id": "sample-json-001",
        "slug": "chapter-001",
        "numberLabel": "Chapter 1",
        "numberSort": 1,
        "title": "Lantern Handshake",
        "publishedAt": "2026-01-01T00:00:00Z",
        "sourceChapterId": "sample-json-001",
    },
    {
        "id": "sample-json-002",
        "slug": "chapter-002",
        "numberLabel": "Chapter 2",
        "numberSort": 2,
        "title": "Blue Proxy Rain",
        "publishedAt": "2026-01-08T00:00:00Z",
        "sourceChapterId": "sample-json-002",
    },
]

SERIES_DETAIL = {
    "id": SERIES_ID,
    "title": "Sample JSON Lantern",
    "url": SERIES_URL,
    "coverUrl": "/mock-covers/iron-lantern.svg",
    "synopsis": "A local JSON source sample used to validate the Gomic bridge before wiring a real scraper.",
    "type": "manhwa",
    "status": "ongoing",
    "authorName": "Local Source",
    "artistName": "Bridge Harness",
    "releaseYear": 2026,
    "genres": ["Action", "Mystery"],
    "chapterCount": len(CHAPTERS),
    "chapters": CHAPTERS,
}

SERIES_IMPORT = {
    "series": {
        "slug": "sample-json-lantern",
        "title": "Sample JSON Lantern",
        "altTitles": ["JSON Lantern"],
        "synopsis": SERIES_DETAIL["synopsis"],
        "coverUrl": SERIES_DETAIL["coverUrl"],
        "type": "manhwa",
        "status": "ongoing",
        "contentRating": "teen",
        "demographic": "general",
        "authorName": SERIES_DETAIL["authorName"],
        "artistName": SERIES_DETAIL["artistName"],
        "releaseYear": 2026,
        "genres": SERIES_DETAIL["genres"],
        "featured": False,
        "sourceSeriesId": SERIES_ID,
        "sourceUrl": SERIES_URL,
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
        for chapter in CHAPTERS
    ],
}

PAGES = {
    "chapter-001": [
        {"pageNumber": 1, "imageUrl": "/mock-pages/iron-lantern-040-1.svg", "width": 900, "height": 1280},
        {"pageNumber": 2, "imageUrl": "/mock-pages/iron-lantern-040-2.svg", "width": 900, "height": 1280},
        {"pageNumber": 3, "imageUrl": "/mock-pages/iron-lantern-040-3.svg", "width": 900, "height": 1280},
    ],
    "chapter-002": [
        {"pageNumber": 1, "imageUrl": "/mock-pages/iron-lantern-041-1.svg", "width": 900, "height": 1280},
        {"pageNumber": 2, "imageUrl": "/mock-pages/iron-lantern-041-2.svg", "width": 900, "height": 1280},
        {"pageNumber": 3, "imageUrl": "/mock-pages/iron-lantern-041-3.svg", "width": 900, "height": 1280},
    ],
}


class Handler(BaseHTTPRequestHandler):
    server_version = "GomicSourceMock/1.0"

    def do_GET(self) -> None:  # noqa: N802 - stdlib hook name
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/healthz":
            self.write_json({"status": "ok"})
            return

        if path == "/search":
            query = parse_qs(parsed.query).get("q", [""])[0].lower()
            if not query or query in SERIES_DETAIL["title"].lower() or query in SERIES_ID:
                self.write_json({"results": [self.search_result()]})
            else:
                self.write_json({"results": []})
            return

        if path == f"/series/{SERIES_ID}":
            self.write_json(SERIES_DETAIL)
            return

        if path == f"/series/{SERIES_ID}/import":
            self.write_json(SERIES_IMPORT)
            return

        prefix = f"/series/{SERIES_ID}/chapters/"
        suffix = "/pages"
        if path.startswith(prefix) and path.endswith(suffix):
            chapter_slug = unquote(path[len(prefix) : -len(suffix)])
            pages = PAGES.get(chapter_slug)
            if pages is None:
                self.write_json({"error": "chapter not found"}, status=404)
                return
            self.write_json({"pages": pages})
            return

        self.write_json({"error": "not found"}, status=404)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def search_result(self) -> dict[str, str]:
        return {
            "id": SERIES_ID,
            "title": SERIES_DETAIL["title"],
            "url": SERIES_DETAIL["url"],
            "coverUrl": SERIES_DETAIL["coverUrl"],
        }

    def write_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a local Gomic JSON source service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=19090)
    args = parser.parse_args()

    address = (args.host, args.port)
    server = ThreadingHTTPServer(address, Handler)
    print(f"Gomic source mock listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
