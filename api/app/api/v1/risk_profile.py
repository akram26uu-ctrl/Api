from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_database,
    require_api_scope,
)
from app.models.merchant import Merchant
from app.repositories.risk_profile_repository import (
    RiskProfileRepository,
)
from app.schemas.risk_profile import RiskProfileResponse, RiskProfileUpdate
from app.services.risk_service import RiskService


router = APIRouter(
    prefix="/risk-profile",
    tags=["Risk Profile"],
)


def profile_to_response(
    profile,
) -> RiskProfileResponse:
    return RiskProfileResponse(
        id=str(profile.id),
        merchant_id=str(profile.merchant_id),

        high_cancel_rate_threshold=(
            profile.high_cancel_rate_threshold
        ),
        high_cancel_rate_min_orders=(
            profile.high_cancel_rate_min_orders
        ),
        high_cancel_rate_score=(
            profile.high_cancel_rate_score
        ),

        phone_reuse_threshold=(
            profile.phone_reuse_threshold
        ),
        phone_reuse_score=(
            profile.phone_reuse_score
        ),

        device_reuse_threshold=(
            profile.device_reuse_threshold
        ),
        device_reuse_score=(
            profile.device_reuse_score
        ),

        address_reuse_threshold=(
            profile.address_reuse_threshold
        ),
        address_reuse_score=(
            profile.address_reuse_score
        ),

        multiple_customers_same_phone_threshold=(
            profile.multiple_customers_same_phone_threshold
        ),
        multiple_customers_same_phone_score=(
            profile.multiple_customers_same_phone_score
        ),

        multiple_phones_same_device_threshold=(
            profile.multiple_phones_same_device_threshold
        ),
        multiple_phones_same_device_score=(
            profile.multiple_phones_same_device_score
        ),

        high_order_frequency_count=(
            profile.high_order_frequency_count
        ),
        high_order_frequency_window_minutes=(
            profile.high_order_frequency_window_minutes
        ),
        high_order_frequency_score=(
            profile.high_order_frequency_score
        ),

        high_ip_frequency_count=(
            profile.high_ip_frequency_count
        ),
        high_ip_frequency_window_minutes=(
            profile.high_ip_frequency_window_minutes
        ),
        high_ip_frequency_score=(
            profile.high_ip_frequency_score
        ),

        multiple_customers_same_ip_threshold=(
            profile.multiple_customers_same_ip_threshold
        ),
        multiple_customers_same_ip_score=(
            profile.multiple_customers_same_ip_score
        ),

        new_device_customer_min_orders=(
            profile.new_device_customer_min_orders
        ),
        new_device_score=(
            profile.new_device_score
        ),

        vpn_score=profile.vpn_score,
        proxy_score=profile.proxy_score,

        review_threshold=profile.review_threshold,
        reject_threshold=profile.reject_threshold,
        max_score=profile.max_score,

        is_active=profile.is_active,
    )


@router.get(
    "",
    response_model=RiskProfileResponse,
)
def get_risk_profile(
    db: Session = Depends(get_database),
    api_key = Depends(require_api_scope("risk_profile:read")),
):
    merchant = api_key.merchant
    if merchant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )

    repository = RiskProfileRepository(db)

    profile = repository.get_by_merchant_id(
        merchant.id,
    )

    if profile is None:
        profile = RiskService(
            db,
        )._get_or_create_profile(
            merchant.id,
        )
        # _get_or_create_profile only flushes; commit so the created profile
        # survives this request (previously every GET 500'd on the detached
        # instance during response serialization).
        db.commit()

    return profile_to_response(profile)

@router.patch("", response_model=RiskProfileResponse)
def update_risk_profile(
    data: RiskProfileUpdate,
    db: Session = Depends(get_database),
    api_key = Depends(require_api_scope("risk_profile:write")),
):
    profile = RiskProfileRepository(db).get_by_merchant_id(api_key.merchant_id)
    if profile is None:
        profile = RiskService(db)._get_or_create_profile(api_key.merchant_id)
        db.commit()
    values = data.model_dump(exclude_none=True)
    for field, value in values.items():
        setattr(profile, field, value)
    # Validate the final pair, not just the individual deltas, so a combined
    # review/reject update can never persist an inverted threshold pair.
    if profile.review_threshold >= profile.reject_threshold:
        raise HTTPException(422, "review_threshold must be lower than reject_threshold")
    profile.version = int(profile.version) + 1
    db.commit(); db.refresh(profile)
    return profile_to_response(profile)
