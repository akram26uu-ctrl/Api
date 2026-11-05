"""Public Meta WhatsApp webhook. No API key: authenticated by the
X-Hub-Signature-256 HMAC of the raw body with the Meta App Secret."""
import hmac
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_database
from app.core.config import settings
from app.services import whatsapp_service

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])
logger = logging.getLogger("ordium.whatsapp")


@router.get("/webhook", response_class=PlainTextResponse)
def verify_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge", max_length=200),
):
    expected = settings.whatsapp_verify_token
    if (
        not expected
        or hub_mode != "subscribe"
        or hub_verify_token is None
        or not hmac.compare_digest(hub_verify_token, expected)
        or not hub_challenge
    ):
        raise HTTPException(status_code=403, detail="Verification failed")
    return hub_challenge


@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_database)):
    raw = await request.body()
    if not whatsapp_service.verify_signature(raw, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(status_code=401, detail="Invalid signature")
    try:
        payload = json.loads(raw or b"{}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc
    try:
        followups = whatsapp_service.handle_webhook(db, payload)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("WhatsApp webhook processing failed")
        # 500 makes Meta retry; inbound wamids are de-duplicated on retry.
        raise HTTPException(status_code=500, detail="Processing failed")
    whatsapp_service.send_followups(followups)
    return {"received": True}
