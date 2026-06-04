"""KomikTap adapter — MangaThemesia template."""
from ..__init__ import SourceConfig
from ..templates.manga_themesia import MangaThemesiaScraper


def create_scraper(config: SourceConfig) -> MangaThemesiaScraper:
    return MangaThemesiaScraper(config)
