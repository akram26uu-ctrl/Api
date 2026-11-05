from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.core.config import settings
from app.models.api_key import ApiKey
from app.models.merchant import Merchant
from app.services.audit_service import AuditService

router = APIRouter(prefix="/confirmation-settings", tags=["Order Confirmation"])

_DECISIONS = ("allow", "review", "reject")


class ConfirmationSettings(BaseModel):
    whatsapp_enabled: bool
    decisions: list[str]
    auto_update_status: bool

    @field_validator("decisions")
    @classmethod
    def validate_decisions(cls, value: list[str]) -> list[str]:
        cleaned = {item.strip().lower() for item in value}
        if not cleaned or not cleaned <= set(_DECISIONS):
            raise ValueError("decisions must be a non-empty subset of: allow, review, reject")
        return [d for d in _DECISIONS if d in cleaned]


def _response(merchant: Merchant) -> dict:
    decisions = [d for d in _DECISIONS if d in (merchant.whatsapp_confirmation_decisions or "").split(",")]
    return {
        "whatsapp_enabled": merchant.whatsapp_confirmation_enabled,
        "decisions": decisions,
        "auto_update_status": merchant.whatsapp_auto_update_status,
        "provider_configured": bool(settings.whatsapp_enabled),
    }


@router.get("")
def get_settings(db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("orders:read"))):
    return _response(db.get(Merchant, api_key.merchant_id))


@router.put("")
def update_settings(
    data: ConfirmationSettings,
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:write")),
):
    merchant = db.get(Merchant, api_key.merchant_id)
    merchant.whatsapp_confirmation_enabled = data.whatsapp_enabled
    merchant.whatsapp_confirmation_decisions = ",".join(data.decisions)
    merchant.whatsapp_auto_update_status = data.auto_update_status
    AuditService(db).record(
        action="confirmation_settings.updated", resource_type="merchant", resource_id=merchant.id,
        merchant_id=merchant.id, api_key_id=api_key.id, environment=api_key.environment,
        metadata={"whatsapp_enabled": data.whatsapp_enabled, "decisions": data.decisions,
                  "auto_update_status": data.auto_update_status},
    )
    db.commit()
    db.refresh(merchant)
    return _response(merchant)
