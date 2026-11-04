"""Decide whether two spellings of a customer name are the same person.

Used only between customers that already share a phone at the same merchant,
so the question is narrow: "is this the same buyer typing their name another
way?" Algerian buyers write the same name in Arabic or Latin script, with
French or English transliteration, in either order, or with the first name
only: "أمينة بن علي", "Amina Benali", "BENALI Amina", "amina ben ali".

Each name becomes a list of consonant skeletons (vowels are where
transliterations disagree most). Two names match when every token of the
shorter one matches a distinct token of the longer one, or when their whole
skeletons are equal. The rule stays conservative: only skeletons of 4+
consonants tolerate a one-letter difference, so "Mohamed" (mhmd) and "Ahmed"
(hmd) remain different people.
"""
from __future__ import annotations

import re
import unicodedata

# Arabic letters → Latin consonant classes. Letters that transliterate as
# vowels or are usually dropped in Latin spellings map to "".
_ARABIC = {
    "ا": "", "أ": "", "إ": "", "آ": "", "ء": "", "ئ": "", "ؤ": "", "ع": "",
    "و": "", "ي": "", "ى": "", "ة": "",
    "ب": "b", "ت": "t", "ث": "t", "ط": "t",
    "ج": "j", "ح": "h", "ه": "h", "خ": "k", "غ": "k", "ق": "k", "ك": "k",
    "د": "d", "ذ": "d", "ض": "d", "ظ": "d",
    "ر": "r", "ز": "z", "س": "s", "ص": "s", "ش": "S",
    "ف": "f", "ڤ": "f", "ل": "l", "م": "m", "ن": "n", "پ": "b", "گ": "k",
}

# Latin digraphs first (order matters), then single letters.
_LATIN_DIGRAPHS = (
    ("dj", "j"), ("sch", "S"), ("ch", "S"), ("sh", "S"), ("kh", "k"), ("gh", "k"),
    ("th", "t"), ("dh", "d"), ("ph", "f"), ("qu", "k"), ("ou", ""),
)
_LATIN = {
    "b": "b", "p": "b", "t": "t", "j": "j", "g": "k", "k": "k", "q": "k", "c": "s",
    "x": "ks", "d": "d", "r": "r", "z": "z", "s": "s", "f": "f", "v": "f",
    "l": "l", "m": "m", "n": "n", "h": "h",
}

# Particles written either attached or detached: "Ben Ali" / "Benali" / "بن علي".
_GLUE = {"ben", "bin", "ibn", "bent", "ould", "ait", "abd", "abou", "bou",
         "بن", "ابن", "بنت", "ولد", "ايت", "عبد", "ابو", "بو"}
# Standalone articles: "El Hadi" / "الهادي".
_ARTICLES = {"el", "al", "ال"}

_ARABIC_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def _tokens(name: str) -> list[str]:
    value = unicodedata.normalize("NFKC", name or "").casefold()
    value = _ARABIC_DIACRITICS.sub("", value)
    value = "".join(ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch))
    raw = [t for t in re.split(r"[^\w]+|_|\d+", value) if t]
    glued: list[str] = []
    pending = ""
    for token in raw:
        if token in _GLUE:
            pending += token
            continue
        glued.append(pending + token)
        pending = ""
    if pending:
        glued.append(pending)
    out = []
    for token in glued:
        if token in _ARTICLES:
            continue
        if token.startswith("ال") and len(token) > 3:
            token = token[2:]
        out.append(token)
    return out


def _skeleton(token: str) -> str:
    if any("؀" <= ch <= "ۿ" for ch in token):
        letters = "".join(_ARABIC.get(ch, "") for ch in token)
    else:
        for digraph, repl in _LATIN_DIGRAPHS:
            token = token.replace(digraph, repl)
        letters = "".join(_LATIN.get(ch, "") if ch != "S" else "S" for ch in token)
    return re.sub(r"(.)\1+", r"\1", letters)


def name_skeletons(name: str) -> list[str]:
    return [s for s in (_skeleton(t) for t in _tokens(name)) if s]


def _close(a: str, b: str) -> bool:
    if a == b:
        return True
    if min(len(a), len(b)) < 4 or abs(len(a) - len(b)) > 1:
        return False
    # Edit distance <= 1.
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) == 1
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    return any(long_[:i] + long_[i + 1:] == short for i in range(len(long_)))


def names_match(a: str, b: str) -> bool:
    sa, sb = name_skeletons(a), name_skeletons(b)
    if not sa or not sb:
        return False
    if "".join(sa) == "".join(sb) or "".join(sa) == "".join(reversed(sb)):
        return True
    short, long_ = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
    remaining = list(long_)
    for token in short:
        match = next((i for i, other in enumerate(remaining) if _close(token, other)), None)
        if match is None:
            return False
        remaining.pop(match)
    return sum(len(t) for t in short) >= 2
