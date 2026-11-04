"""Wilaya / commune lookup for address consistency checks.

Free-text wilaya and commune fields arrive in Arabic, French or English, with
or without accents, codes or prefixes ("16", "16 - Alger", "Wilaya d'Alger",
"الجزائر", "Algiers"). Names are compared by the same Arabic/Latin consonant
skeletons used for customer names, so "Bab Ezzouar" and "باب الزوار" meet.

Lookups are deliberately conservative: anything not recognised returns
None / an empty set, and callers must treat "unknown" as "no evidence".
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from app.core.name_matching import _parse, name_skeletons

_DATA = Path(__file__).resolve().parent.parent / "data" / "algeria_communes.json"

# Wilayas created in 2019 from part of an older wilaya. Buyers (and stores)
# still write the parent wilaya, so a commune of the new wilaya under its
# parent's name is consistent.
NEW_WILAYA_PARENT: dict[str, str] = {
    "49": "01", "50": "01", "51": "07", "52": "08", "53": "11",
    "54": "11", "55": "30", "56": "33", "57": "39", "58": "47",
}

_WILAYA_ALIASES: dict[str, tuple[str, ...]] = {
    "16": ("Algiers", "Alger Centre", "Dzayer"),
    "31": ("Wahran",),
    "06": ("Bougie", "Bejaia"),
    "25": ("Qacentina", "Ksentina"),
    "34": ("BBA",),
    "22": ("Sidi Bel Abbes", "SBA"),
    "23": ("Bone",),
}

_PREFIXES = re.compile(
    r"^\s*(wilaya|wilayah|province|commune|daira|de|d'|du|of|ولاية|بلدية|دائرة)\b[\s'’-]*",
    re.IGNORECASE,
)


# Consonant skeletons shorter than this ("sl", "fl") are shared by too many
# unrelated places to count as recognising a commune.
MIN_SKELETON_EVIDENCE = 4


def _strip_prefixes(text: str) -> str:
    value = text or ""
    for _ in range(3):
        stripped = _PREFIXES.sub("", value)
        if stripped == value:
            break
        value = stripped
    return value


def _key(text: str) -> str:
    return "".join(name_skeletons(_strip_prefixes(text)))


def _spelling_key(text: str) -> str:
    """Same-script spelling (vowels kept): "babezuar", "بابزوار"."""
    return "".join(t.loose for t in _parse(_strip_prefixes(text)))


@lru_cache(maxsize=1)
def _index() -> tuple[dict[str, set[str]], dict[str, set[str]], set[str], dict[str, set[str]]]:
    data = json.loads(_DATA.read_text(encoding="utf-8"))
    wilaya_by_key: dict[str, set[str]] = {}
    for code, names in data["wilayas"].items():
        for name in (*names, *_WILAYA_ALIASES.get(code, ())):
            key = _key(name)
            if key:
                wilaya_by_key.setdefault(key, set()).add(code)
    commune_by_key: dict[str, set[str]] = {}
    commune_by_spelling: dict[str, set[str]] = {}
    for code, ascii_name, arabic_name in data["communes"]:
        for name in (ascii_name, arabic_name):
            key = _key(name)
            if len(key) >= MIN_SKELETON_EVIDENCE:
                commune_by_key.setdefault(key, set()).add(code)
            spelling = _spelling_key(name)
            if spelling:
                commune_by_spelling.setdefault(spelling, set()).add(code)
    return wilaya_by_key, commune_by_key, set(data["wilayas"]), commune_by_spelling


def resolve_wilaya(text: str | None) -> str | None:
    """Wilaya code ("01".."58") for a free-text wilaya, or None if unclear."""
    if not text or not text.strip():
        return None
    wilaya_by_key, _, codes, _ = _index()
    match = re.match(r"^\s*(\d{1,2})(?!\d)", text)
    if match:
        code = f"{int(match.group(1)):02d}"
        return code if code in codes else None
    candidates = wilaya_by_key.get(_key(text), set())
    return next(iter(candidates)) if len(candidates) == 1 else None


def commune_wilayas(text: str | None) -> set[str]:
    """Wilaya codes that have a commune with this name (empty if unknown)."""
    if not text or not text.strip():
        return set()
    _, commune_by_key, _, commune_by_spelling = _index()
    # Exact spelling first; across scripts only a distinctive skeleton counts.
    exact = commune_by_spelling.get(_spelling_key(text))
    if exact:
        return set(exact)
    key = _key(text)
    if len(key) < MIN_SKELETON_EVIDENCE:
        return set()
    return set(commune_by_key.get(key, set()))


def _related(a: str, b: str) -> bool:
    return a == b or NEW_WILAYA_PARENT.get(a) == b or NEW_WILAYA_PARENT.get(b) == a


def location_mismatch(wilaya: str | None, commune: str | None) -> dict | None:
    """Evidence when a recognised commune belongs to no recognised wilaya
    matching the order's wilaya; None when consistent or unknown."""
    wilaya_code = resolve_wilaya(wilaya)
    if wilaya_code is None:
        return None
    commune_codes = commune_wilayas(commune)
    if not commune_codes:
        return None
    if any(_related(wilaya_code, code) for code in commune_codes):
        return None
    return {"wilaya_code": wilaya_code, "commune_wilaya_codes": sorted(commune_codes)}
