"""Public carrier tracking webhook. No API key: the adapter verifies the carrier signature."""
import logging
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_database
from app.models.carrier_account import CarrierAccount
from app.models.shipment import Shipment
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import CarrierAuthError, CarrierError, CarrierValidationError
from app.services.carriers.registry import CarrierNotAvailable
from app.services.tracking_service import TrackingService

router = APIRouter(prefix="/carriers", tags=["Carrier webhooks"])
logger = logging.getLogger("ordium.carrier_webhook")


@router.post("/{carrier_code}/webhook/{account_id}")
async def receive_carrier_webhook(carrier_code: str, account_id: UUID, request: Request,
                                  db: Session = Depends(get_database)):
    account = db.query(CarrierAccount).filter(
        CarrierAccount.id == account_id, CarrierAccount.carrier_code == carrier_code).first()
    if account is None or account.status == "disabled":
        raise HTTPException(status_code=404, detail="Carrier account not found")
    try:
        adapter = CarrierAccountService(db).adapter_for(account)
    except CarrierNotAvailable:
        raise HTTPException(status_code=404, detail="Carrier account not found")
    body = await request.body()
    try:
        parsed = adapter.parse_webhook(dict(request.headers), body)
    except CarrierAuthError:
        raise HTTPException(status_code=401, detail="Invalid signature")
    except CarrierValidationError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except CarrierError:
        raise HTTPException(status_code=400, detail="Invalid payload")

    try:
        accepted = await run_in_threadpool(_apply, db, account, parsed)
    except Exception:
        db.rollback()
        logger.exception("carrier webhook processing failed")
        raise HTTPException(status_code=500, detail="Processing failed")
    return {"accepted": accepted}


def _apply(db: Session, account: CarrierAccount, parsed: list) -> int:
    by_tracking: dict[str, list] = {}
    for tracking, event in parsed:
        by_tracking.setdefault(tracking, []).append(event)
    accepted = 0
    service = TrackingService(db)
    for tracking, events in by_tracking.items():
        shipment = db.query(Shipment).filter(
            Shipment.carrier_account_id == account.id, Shipment.tracking_number == tracking,
        ).order_by(Shipment.created_at.desc()).first()
        if shipment is None:
            continue
        accepted += service.apply_events(shipment, events, "webhook")
    db.commit()
    return accepted
