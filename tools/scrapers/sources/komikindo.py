"""KomikIndo adapter — MangaThemesia template."""
from ..__init__ import SourceConfig
from ..templates.manga_themesia import MangaThemesiaScraper


class KomikIndoScraper(MangaThemesiaScraper):
    pass


def create_scraper(config: SourceConfig) -> KomikIndoScraper:
    return KomikIndoScraper(config)
