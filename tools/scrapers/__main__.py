from __future__ import annotations

import argparse
import importlib
import os
import sys

from . import build_config, run_scraper

SOURCE_CONFIGS = {
    "komikcast": {"base_url": "https://v2.komikcast.fit", "referer": "https://v2.komikcast.fit/"},
    "komikindo": {"base_url": "https://komikindo.fit", "referer": "https://komikindo.fit/"},
    "westmanga": {"base_url": "https://westmanga.co", "referer": "https://westmanga.co/"},
    "komiktap": {"base_url": "https://komiktap.info", "referer": "https://komiktap.info/"},
    "komikindoco": {"base_url": "https://komikindo.co", "referer": "https://komikindo.co/"},
    "manhuascan": {"base_url": "https://manhuascan.us", "referer": "https://manhuascan.us/"},
    "manhwalover": {"base_url": "https://manhwalover.org", "referer": "https://manhwalover.org/"},
    "manhwax": {"base_url": "https://manhwax.com", "referer": "https://manhwax.com/"},
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Gomic source scraper service")
    parser.add_argument("--source", required=True, choices=list(SOURCE_CONFIGS.keys()), help="Source to run")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=19190)
    parser.add_argument("--base-url", default="")
    parser.add_argument("--user-agent", default="")
    parser.add_argument("--referer", default="")
    parser.add_argument("--delay", type=float, default=0.5)
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args()

    default_cfg = SOURCE_CONFIGS.get(args.source, {})
    base_url = args.base_url or default_cfg.get("base_url", "")
    referer = args.referer or default_cfg.get("referer", "") or base_url
    user_agent = args.user_agent or os.getenv("SOURCE_USER_AGENT", "GomicScraper/2.0")
    delay = args.delay if args.delay != 0.5 else float(os.getenv("SOURCE_REQUEST_DELAY", "0.5"))
    timeout = args.timeout if args.timeout != 20.0 else float(os.getenv("SOURCE_TIMEOUT", "20"))

    config = build_config(base_url=base_url, user_agent=user_agent, referer=referer, delay=delay, timeout=timeout)

    module = importlib.import_module(f".sources.{args.source}", package="tools.scrapers")
    scraper = module.create_scraper(config)
    run_scraper(scraper, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
