from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi.encoders import jsonable_encoder


def to_json_safe(value: Any) -> Any:
    """
    Convert application objects into values that can safely be persisted
    in PostgreSQL JSON/JSONB columns.

    Decimal values are represented as strings to avoid floating-point
    precision loss for monetary values.
    """
    return jsonable_encoder(
        value,
        custom_encoder={
            Decimal: str,
        },
    )