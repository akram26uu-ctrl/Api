"""Decide whether two spellings of a customer name are the same person.

Used only between customers that already share a phone at the same merchant,
so the question is narrow: "is this the same buyer typing their name another
way?" Algerian buyers write the same name in Arabic or Latin script, with
French or English transliteration, in either order, or with the first name
only: "أمينة بن علي", "Amina Benali", "BENALI Amina", "amina ben ali".

Two names match when every token of the shorter one matches a distinct token
of the longer one, or when the whole names are equal once concatenated
("Abd el Kader" / "Abdelkader"). Tokens are compared:

* in the same script, letter by letter *with* vowels (one typo allowed only
  for 5+ letters): "Hocine" ≠ "Hassan", "حسين" ≠ "حسن", "Mohamed" = "Mohammed";
* across scripts, by consonant skeleton (vowels are where transliterations
  disagree most): "أمينة" = "Amina", "محمد" = "Mohamed";
* always with the same ending: a final "a" sound (Latin -a/-ah, Arabic
  ة ا اء ى ه) marks most feminine names, so "Karim" ≠ "Karima",
  "Amina" ≠ "Amine", "Sami" ≠ "Samia".

Cross-script matching stays coarser ("Hocine" and "حسن" share a skeleton);
it only runs between customers who already share one phone at one merchant.
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


def _is_arabic(token: str) -> bool:
    return any("\u0600" <= ch <= "\u06ff" for ch in token)


_ARABIC_LOOSE = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})


def _loose(token: str) -> str:
    """Same-script spelling form: keeps vowels, smooths common variants."""
    if _is_arabic(token):
        value = token.translate(_ARABIC_LOOSE)
    else:
        value = token
        for a, b in (("dj", "j"), ("ph", "f"), ("ou", "u"), ("ee", "i"), ("y", "i"), ("sch", "sh"), ("ch", "sh")):
            value = value.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", value)


def _a_ending(token: str) -> bool:
    if _is_arabic(token):
        return token.endswith(("ة", "ا", "اء", "ى", "ه"))
    return token.endswith(("a", "ah"))


def _skeleton(token: str) -> str:
    if _is_arabic(token):
        letters = "".join(_ARABIC.get(ch, "") for ch in token)
    else:
        for digraph, repl in _LATIN_DIGRAPHS:
            token = token.replace(digraph, repl)
        letters = "".join(_LATIN.get(ch, "") if ch != "S" else "S" for ch in token)
    return re.sub(r"(.)\1+", r"\1", letters)


class _Token:
    __slots__ = ("arabic", "loose", "skeleton", "a_ending")

    def __init__(self, raw: str):
        self.arabic = _is_arabic(raw)
        self.loose = _loose(raw)
        self.skeleton = _skeleton(raw)
        self.a_ending = _a_ending(raw)


def _parse(name: str) -> list[_Token]:
    return [t for t in (_Token(raw) for raw in _tokens(name)) if t.skeleton]


def name_skeletons(name: str) -> list[str]:
    return [t.skeleton for t in _parse(name)]


def _one_edit(a: str, b: str) -> bool:
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) == 1
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    return any(long_[:i] + long_[i + 1:] == short for i in range(len(long_)))


def _token_match(a: _Token, b: _Token) -> bool:
    if a.a_ending != b.a_ending:
        return False
    if a.arabic == b.arabic:
        if a.loose == b.loose:
            return True
        return min(len(a.loose), len(b.loose)) >= 5 and _one_edit(a.loose, b.loose)
    if a.skeleton == b.skeleton:
        return True
    return min(len(a.skeleton), len(b.skeleton)) >= 4 and _one_edit(a.skeleton, b.skeleton)


def _concat_match(a: list[_Token], b: list[_Token]) -> bool:
    # Every word's ending must agree, whatever the word boundaries.
    if sum(t.a_ending for t in a) != sum(t.a_ending for t in b):
        return False
    same_script = all(t.arabic for t in a + b) or not any(t.arabic for t in a + b)
    key = (lambda ts: "".join(t.loose for t in ts)) if same_script else (lambda ts: "".join(t.skeleton for t in ts))
    return key(a) == key(b)


def names_match(a: str, b: str) -> bool:
    ta, tb = _parse(a), _parse(b)
    if not ta or not tb:
        return False
    if _concat_match(ta, tb) or _concat_match(ta, list(reversed(tb))):
        return True
    short, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    remaining = list(long_)
    for token in short:
        index = next((i for i, other in enumerate(remaining) if _token_match(token, other)), None)
        if index is None:
            return False
        remaining.pop(index)
    return sum(len(t.skeleton) for t in short) >= 2
