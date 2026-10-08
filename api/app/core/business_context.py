from __future__ import annotations

import re
import unicodedata


BUSINESS_CATEGORY_ALIASES: dict[str, set[str]] = {
    "fashion": {
        "fashion", "clothing", "apparel", "mode", "vetements", "vêtements",
        "ملابس", "ازياء", "أزياء",
    },
    "electronics": {
        "electronics", "electronique", "électronique", "electronic",
        "الكترونيات", "إلكترونيات",
    },
    "home_appliances": {
        "home appliances", "home_appliance", "home-appliances",
        "electromenager", "électroménager", "electro menager",
        "اجهزة منزلية", "أجهزة منزلية",
    },
    "furniture": {"furniture", "meubles", "اثاث", "أثاث"},
    "beauty_cosmetics": {
        "beauty", "cosmetics", "beauté", "beaute", "cosmetique", "cosmétiques",
        "تجميل", "مستحضرات التجميل",
    },
    "food_grocery": {
        "food", "grocery", "groceries", "alimentation", "epicerie", "épicerie",
        "غذاء", "بقالة",
    },
    "health": {"health", "sante", "santé", "pharmacy", "pharmacie", "صحة"},
    "automotive": {"automotive", "automobile", "auto", "سيارات", "السيارات"},
    "sports": {"sports", "sport", "رياضة"},
    "jewelry": {"jewelry", "jewellery", "bijoux", "joaillerie", "مجوهرات"},
    "digital_goods": {"digital goods", "digital", "produits numeriques", "produits numériques", "منتجات رقمية"},
    "other": {"other", "autre", "autres", "other business", "اخرى", "أخرى"},
}

_ALIAS_TO_CATEGORY: dict[str, str] = {}
for _category, _aliases in BUSINESS_CATEGORY_ALIASES.items():
    for _alias in _aliases:
        normalized = unicodedata.normalize("NFKC", _alias).casefold().strip()
        _ALIAS_TO_CATEGORY[normalized] = _category


def normalize_category(value: str | None) -> str:
    if not value:
        return "other"
    normalized = unicodedata.normalize("NFKC", value).casefold().strip()
    if normalized in _ALIAS_TO_CATEGORY:
        return _ALIAS_TO_CATEGORY[normalized]
    normalized = "".join(
        ch for ch in unicodedata.normalize("NFKD", normalized)
        if not unicodedata.combining(ch)
    )
    normalized = re.sub(r"[^\w\s-]", " ", normalized, flags=re.UNICODE)
    normalized = re.sub(r"[\s-]+", "_", normalized).strip("_")
    return normalized[:100] or "other"


def normalize_categories(values: list[str] | None) -> list[str]:
    if not values:
        return []
    result: list[str] = []
    for value in values:
        category = normalize_category(value)
        if category not in result and category != "other":
            result.append(category)
    return result[:20]
