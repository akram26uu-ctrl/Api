"""Shared text folding for comparisons (addresses, quality checks)."""
import unicodedata


def fold(text: str | None) -> str:
    """NFKC + casefold, then strip combining marks (accents, Arabic harakat)."""
    value = unicodedata.normalize("NFKC", text or "").casefold()
    return "".join(ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch))
