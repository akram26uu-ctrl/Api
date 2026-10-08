from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.services.usage_service import get_live_usage

router = APIRouter(prefix="/usage", tags=["Usage"])


@router.get("")
def get_usage(
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("metrics:read")),
):
    if api_key.environment != "live":
        raise HTTPException(403, "Usage is available only for live traffic")
    merchant = api_key.merchant
    if merchant is None:
        raise HTTPException(401, "Invalid or inactive API key")
    usage = get_live_usage(db, merchant)
    return {
        **usage,
        "rate_limit_per_min": usage["rate_limit_per_min"],
        "billing_cycle_resets_in_days": max(0, (usage["period_end"] - usage["period_start"]).days),
        "source": "live",
    }
