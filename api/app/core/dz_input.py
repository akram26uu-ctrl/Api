"""Normalization of what stores and buyers type, shared by every order path
(API body and store webhooks) so an order is never lost to formatting."""
from __future__ import annotations

import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

_SPACES = re.compile(r"[\s   '’]+")
_CURRENCY = re.compile(r"(dzd|da|د\.?\s?ج|دج|دينار)", re.IGNORECASE)


def ascii_digits(text: str) -> str:
    """Arabic-Indic / Persian digits (٠١٢ / ۰۱۲) → ASCII; other characters kept."""
    out = []
    for ch in text:
        if ch.isdigit() and not ch.isascii():
            try:
                out.append(str(unicodedata.digit(ch)))
                continue
            except (TypeError, ValueError):
                pass
        out.append(ch)
    return "".join(out)


def normalize_dz_phone(value) -> str:
    """Local 10-digit form for Algerian numbers written in common ways:
    +213 / 00213 / 213 prefixes, "(0)" after the country code, a missing
    leading 0, spaces, dashes, dots, Arabic-Indic digits."""
    if value is None:
        return ""
    text = ascii_digits(str(value)).strip()
    plus = text.startswith("+")
    digits = "".join(ch for ch in text if ch.isdigit())
    if plus and digits.startswith("213"):
        digits = digits[3:]
    elif digits.startswith("00213"):
        digits = digits[5:]
    elif digits.startswith("213") and len(digits) in (12, 13):
        digits = digits[3:]
    else:
        return digits if len(digits) != 9 or digits[0] not in "567" else "0" + digits
    # After a country code: drop a "(0)" trunk prefix, then restore the local 0.
    if digits.startswith("0"):
        digits = digits[1:]
    return "0" + digits


def parse_amount(value) -> Decimal:
    """Amount as stores send it: "1500", "1,500.00", "1 500,00", "1.500,00",
    "2 500 DA", Arabic-Indic digits. Raises ValueError when not a number."""
    if value is None or isinstance(value, bool):
        raise ValueError("missing amount")
    if isinstance(value, (int, Decimal)):
        return Decimal(value)
    if isinstance(value, float):
        return Decimal(str(value))
    text = _CURRENCY.sub("", ascii_digits(str(value)))
    text = _SPACES.sub("", text).strip()
    if not text:
        raise ValueError("missing amount")
    if "," in text and "." in text:
        decimal_sep = "," if text.rfind(",") > text.rfind(".") else "."
        thousands = "." if decimal_sep == "," else ","
        text = text.replace(thousands, "").replace(decimal_sep, ".")
    elif "," in text:
        # "1,500" / "1,500,000" are thousands; "12,5" / "1500,00" are decimals.
        text = text.replace(",", "") if re.fullmatch(r"-?\d{1,3}(,\d{3})+", text) else text.replace(",", ".")
    elif text.count(".") > 1 or re.fullmatch(r"-?\d{1,3}\.\d{3}", text):
        # DZD has at most 2 decimals, so "1.500" / "1.500.000" are thousands.
        text = text.replace(".", "")
    try:
        amount = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("invalid amount") from exc
    if not amount.is_finite():
        raise ValueError("invalid amount")
    return amount


def to_cents(value):
    """parse_amount rounded to cents (discounts give 833.3333 unit prices).
    Unparseable input is passed through so the schema reports the field."""
    try:
        return parse_amount(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (ValueError, TypeError):
        return value
