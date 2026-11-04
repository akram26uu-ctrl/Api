"""Cheap first-order checks on what the buyer typed.

Fake COD orders are often typed in a hurry: "test test", "aaa", a keyboard
mash, digits in the name, or a phone like 0555555555. These checks work on
the very first order (no history needed) and return *reasons* so the merchant
sees exactly what looked wrong. They are intentionally narrow: real Algerian
names written in Arabic have no Latin vowels, abbreviations like "Mhd" are
short, and nothing here fires on an unusual-but-plausible name.
"""
from __future__ import annotations

import re
import unicodedata

# Algerian mobile numbers: 05 (Ooredoo), 06 (Mobilis), 07 (Djezzy).
MOBILE_PREFIXES = ("05", "06", "07")

_PLACEHOLDER_WORDS = {
    "test", "tests", "testing", "fake", "xxx", "xx", "aaa", "abc", "asdf", "qwerty", "azerty",
    "qsdf", "null", "none", "nan", "undefined", "anonymous", "client", "customer", "nom", "prenom",
    "name", "firstname", "lastname", "tst", "demo",
    "تجربة", "اختبار", "تست", "مجهول", "زبون", "اسم",
}

_LATIN_VOWELS = set("aeiouy")


def _fold(text: str) -> str:
    value = unicodedata.normalize("NFKC", text or "").casefold()
    return "".join(ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch))


def _words(text: str) -> list[str]:
    return [w for w in re.split(r"[^\w]+|_", _fold(text)) if w]


def _is_mash(word: str) -> bool:
    """Latin keyboard mash: 5+ letters and no vowel ("dfghj", "qsdfg")."""
    return len(word) >= 5 and word.isascii() and word.isalpha() and not (set(word) & _LATIN_VOWELS)


def _is_repeated(word: str) -> bool:
    return len(word) >= 3 and len(set(word)) == 1


def identity_quality_issues(first_name: str, last_name: str, address: str | None) -> list[str]:
    issues: list[str] = []
    name_words = _words(f"{first_name} {last_name}")
    if any(ch.isdigit() for ch in f"{first_name}{last_name}"):
        issues.append("digits_in_name")
    if any(w in _PLACEHOLDER_WORDS for w in name_words):
        issues.append("placeholder_name")
    if any(_is_repeated(w) or _is_mash(w) for w in name_words):
        issues.append("gibberish_name")

    if address is None:  # no address on the order: nothing to judge
        return issues
    address_words = _words(address)
    letters = sum(ch.isalpha() for ch in _fold(address))
    if letters < 3:
        issues.append("address_without_text")
    if any(w in _PLACEHOLDER_WORDS for w in address_words):
        issues.append("placeholder_address")
    if address_words and all(_is_repeated(w) or _is_mash(w) or w.isdigit() for w in address_words) and letters >= 3:
        issues.append("gibberish_address")
    return issues


def phone_issues(phone: str) -> list[str]:
    """Issues for a normalized 10-digit Algerian number (see OrderCreate)."""
    if not phone or len(phone) != 10 or not phone.isdigit():
        return []
    issues: list[str] = []
    if not phone.startswith(MOBILE_PREFIXES):
        issues.append("not_a_mobile_prefix")
    subscriber = phone[2:]
    if len(set(subscriber)) <= 2:
        issues.append("repeated_digits")
    elif subscriber in "0123456789012345" or subscriber in "9876543210987654":
        issues.append("sequential_digits")
    return issues
