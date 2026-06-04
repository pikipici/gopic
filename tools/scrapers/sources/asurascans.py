"""Asura Scans adapter — Madara template."""
from ..__init__ import SourceConfig
from ..templates.madara import MadaraScraper


class AsuraScansScraper(MadaraScraper):
    pass


def create_scraper(config: SourceConfig) -> AsuraScansScraper:
    return AsuraScansScraper(config)
