"""Sign in / sign up with Google.

Flow:
1. ``POST /auth/google/start`` returns Google's authorization URL and stores the
   state, nonce and PKCE verifier in a short-lived encrypted HttpOnly cookie.
2. Google redirects the browser to the Web page ``/auth/google/callback``, which
   posts ``code`` and ``state`` to ``POST /auth/google/callback``.
3. An account already linked to the Google identity (or an active account with
   the same verified email) is signed in. Otherwise the verified Google identity
   is kept in a second encrypted cookie and the client shows a short form for the
   store details Google does not provide (store name, monthly orders, ...).
4. ``POST /auth/google/complete-signup`` provisions the workspace exactly like
   email registration, without a password and without email verification
   (Google has already verified the mailbox).
"""
import json
import logging
import secrets
from datetime import datetime, timezone

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import _create_dashboard_keys, _dashboard_keys_for_user, _rate_limit
from app.auth import _fernet, create_session, session_response, set_session_cookie
from app.core.config import settings
from app.db import get_db
from app.models.membership import Membership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    GoogleCallbackRequest,
    GoogleCallbackResponse,
    GoogleConfigResponse,
    GoogleProfile,
    GoogleSignupRequest,
    GoogleStartResponse,
    SessionResponse,
)
from app.services import google_oauth
from app.services.ordium_api import OrdiumApiError, OrdiumProvisioningClient

router = APIRouter(prefix="/auth/google", tags=["Auth"])
logger = logging.getLogger(__name__)

STATE_COOKIE = "ordium_google_oauth"
STATE_TTL_SECONDS = 600
SIGNUP_COOKIE = "ordium_google_signup"
SIGNUP_TTL_SECONDS = 1800


def _require_enabled() -> None:
    if not settings.google_enabled:
        raise HTTPException(status_code=404, detail="Google sign-in is not enabled")


def _seal(payload: dict) -> str:
    return _fernet().encrypt(json.dumps(payload).encode("utf-8")).decode("ascii")


def _unseal(raw: str | None, ttl: int) -> dict | None:
    if not raw:
        return None
    try:
        value = json.loads(_fernet().decrypt(raw.encode("ascii"), ttl=ttl))
    except (InvalidToken, ValueError, UnicodeError):
        return None
    return value if isinstance(value, dict) else None


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(name, value, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=max_age, path="/")


def _clear_cookie(response: Response, name: str) -> None:
    response.delete_cookie(name, path="/", secure=settings.cookie_secure, httponly=True, samesite="lax")


def _open_session(db: Session, response: Response, user: User) -> SessionResponse:
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at.asc()))
    if membership is None or membership.organization.merchant_id is None:
        raise HTTPException(status_code=403, detail="Organization membership not found")
    try:
        (test_id, test_key), (live_id, live_key) = _dashboard_keys_for_user(db, user, OrdiumProvisioningClient(), membership.organization.merchant_id)
    except OrdiumApiError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Unable to create dashboard session") from exc
    session, raw = create_session(db, user, test_id, test_key, live_key)
    session.ordium_live_api_key_id = live_id
    db.commit()
    set_session_cookie(response, raw)
    return session_response(db, user, membership)


@router.get("/config", response_model=GoogleConfigResponse)
def google_config():
    return GoogleConfigResponse(enabled=settings.google_enabled)


@router.post("/start", response_model=GoogleStartResponse)
def google_start(request: Request, response: Response):
    _require_enabled()
    _rate_limit(request, "google_start", 30)
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier, challenge = google_oauth.new_pkce_pair()
    _set_cookie(response, STATE_COOKIE, _seal({"state": state, "nonce": nonce, "verifier": verifier}), STATE_TTL_SECONDS)
    return GoogleStartResponse(authorization_url=google_oauth.authorization_url(state=state, nonce=nonce, code_challenge=challenge))


@router.post("/callback", response_model=GoogleCallbackResponse)
def google_callback(data: GoogleCallbackRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _require_enabled()
    _rate_limit(request, "google_callback", 20)
    pending = _unseal(request.cookies.get(STATE_COOKIE), STATE_TTL_SECONDS)
    # The state cookie is single-use whatever the outcome.
    _clear_cookie(response, STATE_COOKIE)
    if pending is None or not isinstance(pending.get("state"), str) or not secrets.compare_digest(pending["state"], data.state):
        raise HTTPException(status_code=400, detail="Google sign-in expired or was started in another browser; please try again")
    try:
        identity = google_oauth.exchange_code(data.code, code_verifier=pending["verifier"], nonce=pending["nonce"])
    except google_oauth.GoogleOAuthError as exc:
        logger.warning("Google sign-in rejected: %s", exc)
        raise HTTPException(status_code=400, detail="Google sign-in could not be completed; please try again") from exc

    user = db.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == identity.email))
        if user is not None:
            if user.google_sub is not None:
                # The email belongs to an account linked to a different Google identity.
                raise HTTPException(status_code=409, detail="This email is linked to a different Google account")
            if user.status != "active":
                # Never attach a Google identity to an account whose owner has not proven the
                # mailbox: whoever registered it might not own the address.
                raise HTTPException(status_code=409, detail="An account with this email is waiting for email verification; open the verification link or sign in with your password")
            user.google_sub = identity.sub
            if user.email_verified_at is None:
                user.email_verified_at = datetime.now(timezone.utc)
    if user is not None:
        return GoogleCallbackResponse(status="signed_in", session=_open_session(db, response, user))

    profile = GoogleProfile(email=identity.email, first_name=identity.first_name, last_name=identity.last_name)
    _set_cookie(response, SIGNUP_COOKIE, _seal({"sub": identity.sub, **profile.model_dump(mode="json")}), SIGNUP_TTL_SECONDS)
    return GoogleCallbackResponse(status="signup_required", profile=profile)


def _pending_signup(request: Request) -> dict:
    pending = _unseal(request.cookies.get(SIGNUP_COOKIE), SIGNUP_TTL_SECONDS)
    if pending is None or not isinstance(pending.get("sub"), str) or not isinstance(pending.get("email"), str):
        raise HTTPException(status_code=401, detail="Google sign-up expired; please continue with Google again")
    return pending


@router.get("/pending", response_model=GoogleProfile)
def google_pending(request: Request):
    _require_enabled()
    pending = _pending_signup(request)
    return GoogleProfile(email=pending["email"], first_name=pending.get("first_name") or "", last_name=pending.get("last_name") or "")


@router.post("/complete-signup", response_model=SessionResponse, status_code=201)
def google_complete_signup(data: GoogleSignupRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _require_enabled()
    _rate_limit(request, "register", 10)
    pending = _pending_signup(request)
    email = pending["email"].strip().lower()
    if db.scalar(select(User).where((User.email == email) | (User.google_sub == pending["sub"]))):
        _clear_cookie(response, SIGNUP_COOKIE)
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    provisioning = OrdiumProvisioningClient()
    try:
        merchant_id = provisioning.provision_merchant(name=data.organization_name, email=email, business_type=data.business_type)
        provisioning.ensure_store(merchant_id)
    except OrdiumApiError as exc:
        raise HTTPException(status_code=503, detail="Unable to provision ORDIUM workspace") from exc

    now = datetime.now(timezone.utc)
    user = User(email=email, password_hash=None, google_sub=pending["sub"], first_name=data.first_name, last_name=data.last_name, status="active", email_verified_at=now)
    org = Organization(name=data.organization_name, merchant_id=merchant_id, country=data.country, wilaya=data.wilaya, city=data.city, website_url=str(data.website_url) if data.website_url else None, ecommerce_platform=data.ecommerce_platform, business_type=data.business_type, primary_market=data.primary_market, phone=data.phone, monthly_orders=data.monthly_orders)
    db.add_all([user, org])
    try:
        db.flush()
    except IntegrityError as exc:
        # A concurrent request created the same account first.
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    membership = Membership(user_id=user.id, organization_id=org.id, role="owner")
    db.add(membership)
    db.flush()

    try:
        provisioning.activate_merchant(merchant_id)
        provisioning.ensure_store(merchant_id)
        (test_id, test_key), (live_id, live_key) = _create_dashboard_keys(provisioning, merchant_id)
    except OrdiumApiError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Workspace provisioning is not ready") from exc
    session, raw = create_session(db, user, test_id, test_key, live_key)
    session.ordium_live_api_key_id = live_id
    db.commit()
    set_session_cookie(response, raw)
    _clear_cookie(response, SIGNUP_COOKIE)
    return session_response(db, user, membership)
