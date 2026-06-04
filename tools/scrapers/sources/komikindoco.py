"""KomikIndo.co adapter — MangaThemesia template."""
from ..__init__ import SourceConfig
from ..templates.manga_themesia import MangaThemesiaScraper


class KomikIndoCoScraper(MangaThemesiaScraper):
    pass


def create_scraper(config: SourceConfig) -> KomikIndoCoScraper:
    return KomikIndoCoScraper(config)
