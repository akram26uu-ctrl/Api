import hashlib
import secrets
import base64
from cryptography.fernet import Fernet
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db import get_db
from app.models.membership import Membership
from app.models.session import Session as DbSession
from app.models.user import User
from app.schemas.auth import SessionResponse

COOKIE_NAME = "ordium_session"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _fernet() -> Fernet:
    raw = settings.session_encryption_key.encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)

def _encrypt_dashboard_key(value: str | None) -> bytes | None:
    return _fernet().encrypt(value.encode("utf-8")) if value else None

def _decrypt_dashboard_key(value: bytes | None) -> str | None:
    return _fernet().decrypt(value).decode("utf-8") if value else None

def create_session(db: Session, user: User, ordium_api_key_id=None, dashboard_test_key: str | None = None, dashboard_live_key: str | None = None) -> tuple[DbSession, str]:
    raw = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds)
    session = DbSession(user_id=user.id, token_hash=_hash_token(raw), expires_at=expires, ordium_api_key_id=ordium_api_key_id, ordium_api_key_encrypted=_encrypt_dashboard_key(dashboard_test_key), ordium_live_api_key_encrypted=_encrypt_dashboard_key(dashboard_live_key))
    db.add(session)
    db.flush()
    return session, raw


def get_current_session(request: Request, db: Session = Depends(get_db)) -> tuple[DbSession, User, Membership]:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    session = db.scalar(select(DbSession).where(DbSession.token_hash == _hash_token(raw), DbSession.revoked_at.is_(None)))
    if session is None or session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user = db.get(User, session.user_id)
    if user is None or user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at.asc()))
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization membership not found")
    session.last_seen_at = datetime.now(timezone.utc)
    return session, user, membership


def set_session_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        raw,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def session_response(db: Session, user: User, membership: Membership) -> SessionResponse:
    org = membership.organization
    return SessionResponse(
        user={"id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name, "status": user.status},
        organization={"id": org.id, "name": org.name, "merchant_id": org.merchant_id, "country": org.country, "wilaya": org.wilaya, "city": org.city, "website_url": org.website_url, "ecommerce_platform": org.ecommerce_platform, "business_type": org.business_type, "primary_market": org.primary_market, "phone": org.phone, "monthly_orders": org.monthly_orders},
        role=membership.role,
    )
