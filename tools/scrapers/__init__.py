from __future__ import annotations

import argparse
import html
import importlib
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen


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
    def __init__(self, config: SourceConfig) -> None:
        self.config = config
        self.last_request_at = 0.0

    def search(self, query: str) -> dict[str, Any]:
        if not query.strip():
            return {"results": []}
        raise SourceError("search not implemented", status=501)

    def detail(self, series_id: str) -> dict[str, Any]:
        raise SourceError(f"detail not implemented for {series_id}", status=501)

    def import_series(self, series_id: str) -> dict[str, Any]:
        raise SourceError(f"import not implemented for {series_id}", status=501)

    def pages(self, series_id: str, chapter_slug: str) -> dict[str, Any]:
        raise SourceError(f"pages not implemented for {series_id}/{chapter_slug}", status=501)

    def fetch_text(self, path_or_url: str, accept: str = "text/html,application/xhtml+xml") -> str:
        if not self.config.base_url and not path_or_url.startswith(("http://", "https://")):
            raise SourceError("base_url required", status=500)
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
            with urlopen(request, timeout=self.config.timeout) as response:
                self.last_request_at = time.monotonic()
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")
        except HTTPError as error:
            raise SourceError(f"HTTP {error.code}: {url}", status=502) from error
        except URLError as error:
            raise SourceError(f"request failed: {error.reason}", status=502) from error

    def fetch_json(self, path_or_url: str) -> dict[str, Any]:
        try:
            payload = json.loads(self.fetch_text(path_or_url, accept="application/json"))
        except json.JSONDecodeError as error:
            raise SourceError("invalid JSON", status=502) from error
        if not isinstance(payload, dict):
            raise SourceError("unexpected JSON shape", status=502)
        return payload

    @staticmethod
    def _attr(html_text: str, attr: str) -> str:
        match = re.search(rf'{attr}=["\']([^"\']+)["\']', html_text, flags=re.I)
        return html.unescape(match.group(1)) if match else ""

    @staticmethod
    def _text(fragment: str) -> str:
        cleaned = re.sub(r"<[^>]+>", " ", fragment or "")
        return re.sub(r"\s+", " ", html.unescape(cleaned)).strip()

    @staticmethod
    def _image_urls(fragment: str) -> list[str]:
        urls: list[str] = []
        for match in re.finditer(r'<img[^>]+(?:src|data-src|data-lazy-src)=["\']([^"\']+)["\']', fragment, flags=re.I):
            url = html.unescape(match.group(1)).strip()
            if url and not url.startswith("data:") and url not in urls:
                urls.append(url)
        return urls

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
    def _number(value: Any) -> float:
        match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
        return float(match.group(0)) if match else 0.0

    @staticmethod
    def _format_chapter_index(value: Any) -> str:
        number = Scraper._number(value)
        return str(int(number)) if number.is_integer() else f"{number:g}"

    @staticmethod
    def _year(value: Any) -> int | None:
        match = re.search(r"\d{4}", str(value or ""))
        return int(match.group(0)) if match else None

    @staticmethod
    def _date_from_text(value: str) -> str | None:
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                parsed = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
                return parsed.isoformat().replace("+00:00", "Z")
            except ValueError:
                pass
        return None

    def _abs_url(self, url: str) -> str:
        return urljoin(self.config.base_url.rstrip("/") + "/", url)

    def _slug_from_url(self, url: str) -> str:
        parts = [part for part in urlparse(url).path.split("/") if part]
        return parts[-1] if parts else ""


class Handler(BaseHTTPRequestHandler):
    scraper: Scraper
    server_version = "GomicScraper/2.0"

    def do_GET(self) -> None:
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


def build_config(base_url: str = "", user_agent: str = "", referer: str = "", delay: float = 0.5, timeout: float = 20.0) -> SourceConfig:
    return SourceConfig(
        base_url=base_url,
        user_agent=user_agent or "GomicScraper/2.0",
        referer=referer,
        request_delay=delay,
        timeout=timeout,
    )


def run_scraper(scraper: Scraper, host: str = "127.0.0.1", port: int = 19190) -> None:
    Handler.scraper = scraper
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Gomic scraper listening on http://{host}:{port} ({scraper.__class__.__name__})")
    server.serve_forever()
