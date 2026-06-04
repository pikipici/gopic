"""ManhwaLover adapter — Madara template."""
from ..__init__ import SourceConfig
from ..templates.madara import MadaraScraper


def create_scraper(config: SourceConfig) -> MadaraScraper:
    return MadaraScraper(config)
