from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.auth import COOKIE_NAME, _decrypt_dashboard_key, clear_session_cookie, create_session, get_current_session, session_response, set_session_cookie
from app.db import get_db
from app.models.membership import Membership
from app.models.session import Session as DbSession
from app.models.user import User
from app.models.email_verification import EmailVerificationToken
from app.models.organization import Organization
from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, SessionResponse, AccountSettingsUpdateRequest, ChangePasswordRequest, SessionInfo, VerifyEmailRequest, ResendVerificationRequest
from app.services.ordium_api import OrdiumProvisioningClient, OrdiumApiError
from app.services.passwords import hash_password, verify_password
from app.services.verification import VerificationService
from app.services.email import send_verification_email, EmailDeliveryError
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from threading import Lock
import logging

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger(__name__)
_RATE_BUCKETS: dict[str, deque[datetime]] = defaultdict(deque)
_RATE_LIMIT_LOCK = Lock()
_RATE_BUCKET_MAX = 20_000
_RATE_CLEANUP_INTERVAL = 128
_rate_limit_calls = 0

def _rate_limit(request: Request, bucket: str, limit: int, window_seconds: int = 60) -> None:
    global _rate_limit_calls
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)
    client_host = request.client.host if request.client else "unknown"
    key = f"{bucket}:{client_host}"
    with _RATE_LIMIT_LOCK:
        _rate_limit_calls += 1
        q = _RATE_BUCKETS.get(key)
        if q is None:
            if len(_RATE_BUCKETS) >= _RATE_BUCKET_MAX:
                for old_key in list(_RATE_BUCKETS)[: max(1, _RATE_BUCKET_MAX // 20)]:
                    _RATE_BUCKETS.pop(old_key, None)
            q = deque()
            _RATE_BUCKETS[key] = q
        while q and q[0] <= cutoff:
            q.popleft()
        if _rate_limit_calls % _RATE_CLEANUP_INTERVAL == 0:
            for old_key, old_q in list(_RATE_BUCKETS.items()):
                while old_q and old_q[0] <= cutoff:
                    old_q.popleft()
                if not old_q:
                    _RATE_BUCKETS.pop(old_key, None)
        if len(q) >= limit:
            raise HTTPException(status_code=429, detail="Too many account requests; retry later")
        q.append(now)

def _registration_response(user, membership, *, verification_required=False, verification_token=None, initial_test_api_key=None):
    org = membership.organization
    return RegisterResponse(
        user={"id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name, "status": user.status},
        organization={"id": org.id, "name": org.name, "merchant_id": org.merchant_id, "country": org.country, "wilaya": org.wilaya, "city": org.city, "website_url": org.website_url, "ecommerce_platform": org.ecommerce_platform, "business_type": org.business_type, "primary_market": org.primary_market, "phone": org.phone, "monthly_orders": org.monthly_orders},
        role=membership.role, initial_test_api_key=initial_test_api_key,
        verification_required=verification_required, verification_token=verification_token,
    )

def _create_dashboard_keys(provisioning, merchant_id):
    test_id, test_key = provisioning.create_dashboard_key(merchant_id, "test")
    live_id, live_key = provisioning.create_dashboard_key(merchant_id, "live")
    return (test_id, test_key), (live_id, live_key)

def _dashboard_keys_for_user(db, user, provisioning, merchant_id):
    # Reuse the newest decryptable dashboard key pair from a prior non-revoked
    # session. Provisioning a fresh pair on every login/verification accumulated
    # orphaned API keys in the ORDIUM core for merchants with multiple sessions.
    sessions = db.scalars(
        select(DbSession)
        .where(DbSession.user_id == user.id, DbSession.revoked_at.is_(None))
        .order_by(DbSession.last_seen_at.desc())
    ).all()
    for row in sessions:
        if row.ordium_api_key_id is None or row.ordium_live_api_key_id is None:
            continue
        try:
            test_key = _decrypt_dashboard_key(row.ordium_api_key_encrypted)
            live_key = _decrypt_dashboard_key(row.ordium_live_api_key_encrypted)
        except Exception:
            # An undecryptable session (e.g. rotated encryption key) cannot
            # contribute keys; keep scanning older sessions.
            continue
        if test_key and live_key:
            return (row.ordium_api_key_id, test_key), (row.ordium_live_api_key_id, live_key)
    return _create_dashboard_keys(provisioning, merchant_id)

def _dashboard_keys_shared(db, session) -> bool:
    # True when another non-revoked session of the same user still references
    # either dashboard key, so logout must not revoke keys that remain in use.
    clauses = []
    if session.ordium_api_key_id is not None:
        clauses.append(DbSession.ordium_api_key_id == session.ordium_api_key_id)
    if session.ordium_live_api_key_id is not None:
        clauses.append(DbSession.ordium_live_api_key_id == session.ordium_live_api_key_id)
    if not clauses:
        return False
    shared = db.scalar(
        select(DbSession.id)
        .where(
            DbSession.user_id == session.user_id,
            DbSession.id != session.id,
            DbSession.revoked_at.is_(None),
            or_(*clauses),
        )
        .limit(1)
    )
    return shared is not None

def _revoke_session_dashboard_keys(db: Session, session: DbSession) -> None:
    """Revoke the ORDIUM dashboard API keys bound to a browser session.

    Called whenever a session is revoked (password change, revoke-others, or
    single-session revoke) so the per-session dashboard keys cannot be reused.
    Keys still shared with other live sessions are left alone — revoking one
    session must not break the remaining sessions that legitimately reuse the
    same key pair. Best-effort: external revocation failures are logged but
    never block local session revocation, matching the logout contract.
    """
    if not (session.ordium_api_key_id or session.ordium_live_api_key_id):
        return
    if _dashboard_keys_shared(db, session):
        return
    try:
        user = db.get(User, session.user_id)
        membership = db.scalar(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at.asc())) if user else None
        if membership and membership.organization.merchant_id:
            provisioning = OrdiumProvisioningClient()
            if session.ordium_api_key_id:
                provisioning.revoke_api_key(membership.organization.merchant_id, session.ordium_api_key_id)
            if session.ordium_live_api_key_id:
                provisioning.revoke_api_key(membership.organization.merchant_id, session.ordium_live_api_key_id)
    except Exception:
        logger.exception("Failed to revoke dashboard API keys for session %s", session.id)

@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(data: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate_limit(request, "register", 10)
    email = str(data.email).strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    provisioning = OrdiumProvisioningClient()
    try:
        merchant_id = provisioning.provision_merchant(name=data.organization_name, email=email, business_type=data.business_type)
        provisioning.ensure_store(merchant_id)
    except OrdiumApiError as exc:
        raise HTTPException(status_code=503, detail="Unable to provision ORDIUM workspace") from exc

    user_status = "pending_verification" if settings.require_email_verification else "active"
    user = User(email=email, password_hash=hash_password(data.password), first_name=data.first_name.strip(), last_name=data.last_name.strip(), status=user_status)
    org = Organization(name=data.organization_name.strip(), merchant_id=merchant_id, country=data.country.strip(), wilaya=data.wilaya, city=data.city, website_url=str(data.website_url) if data.website_url else None, ecommerce_platform=data.ecommerce_platform, business_type=data.business_type, primary_market=data.primary_market, phone=data.phone, monthly_orders=data.monthly_orders)
    db.add_all([user, org]); db.flush()
    membership = Membership(user_id=user.id, organization_id=org.id, role="owner")
    db.add(membership); db.flush()

    if user_status != "active":
        token = VerificationService(db).create(user)
        try:
            send_verification_email(recipient=email, first_name=user.first_name, token=token)
        except EmailDeliveryError as exc:
            db.rollback()
            raise HTTPException(status_code=503, detail="Email verification delivery is temporarily unavailable") from exc
        db.commit()
        # Verification tokens are delivered by email. Tests may expose them for automation; local
        # development requires an explicit opt-in. Staging and production never return tokens.
        env = settings.environment.strip().lower()
        expose_token = env == "test" or (env == "development" and settings.expose_verification_token)
        return _registration_response(user, membership, verification_required=True, verification_token=token if expose_token else None)

    try:
        provisioning.activate_merchant(merchant_id)
        provisioning.ensure_store(merchant_id)
        (dashboard_test_id, dashboard_test_key), (dashboard_live_id, dashboard_live_key) = _create_dashboard_keys(provisioning, merchant_id)
    except OrdiumApiError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Workspace provisioning is not ready") from exc
    session, raw = create_session(db, user, dashboard_test_id, dashboard_test_key, dashboard_live_key)
    session.ordium_live_api_key_id = dashboard_live_id
    db.commit()
    set_session_cookie(response, raw)
    return _registration_response(user, membership, initial_test_api_key=None, verification_required=False)

@router.post("/verify-email", response_model=SessionResponse)
def verify_email(
    response: Response,
    data: VerifyEmailRequest | None = None,
    token: str | None = None,
    db: Session = Depends(get_db),
):
    # Accept the previous query-string contract during staggered frontend/backend deploys.
    # The current web client sends the token in the POST body to avoid URL/log leakage.
    raw_token = data.token if data is not None else token
    if not raw_token:
        raise HTTPException(status_code=422, detail="Verification token is required")
    user = VerificationService(db).consume(raw_token.strip())
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at.asc()))
    if membership is None or membership.organization.merchant_id is None:
        db.rollback()
        raise HTTPException(status_code=409, detail="Organization provisioning is incomplete")
    provisioning = OrdiumProvisioningClient()
    try:
        provisioning.activate_merchant(membership.organization.merchant_id)
        provisioning.ensure_store(membership.organization.merchant_id)
        (dashboard_test_id, dashboard_test_key), (dashboard_live_id, dashboard_live_key) = _dashboard_keys_for_user(db, user, provisioning, membership.organization.merchant_id)
    except OrdiumApiError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Workspace activation is temporarily unavailable") from exc
    session, raw = create_session(db, user, dashboard_test_id, dashboard_test_key, dashboard_live_key)
    session.ordium_live_api_key_id = dashboard_live_id
    db.commit()
    set_session_cookie(response, raw)
    return session_response(db, user, membership)

@router.post("/resend-verification")
def resend_verification(data: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()
    # Persisted throttling: the token table provides a rolling four-hour history,
    # so limits survive restarts and multiple Control Plane instances.
    user = db.scalar(select(User).where(User.email == email))
    if user is None or user.status == "active" or user.email_verified_at is not None:
        # Do not disclose whether an account exists or is already verified.
        return {"message": "If the account needs verification, an email will be sent."}

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=4)
    # Exclude the original registration email from the resend quota, even if
    # it was sent inside this four-hour window.
    initial_token_id = (
        select(EmailVerificationToken.id)
        .where(EmailVerificationToken.user_id == user.id)
        .order_by(EmailVerificationToken.created_at.asc(), EmailVerificationToken.id.asc())
        .limit(1)
        .scalar_subquery()
    )
    recent_count = db.scalar(
        select(func.count(EmailVerificationToken.id)).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.created_at >= window_start,
            EmailVerificationToken.id != initial_token_id,
        )
    ) or 0
    latest = db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user.id)
        .order_by(EmailVerificationToken.created_at.desc())
        .limit(1)
    )
    if latest is not None:
        latest_created = latest.created_at
        if latest_created.tzinfo is None:
            latest_created = latest_created.replace(tzinfo=timezone.utc)
        if latest_created > now - timedelta(minutes=2):
            raise HTTPException(status_code=429, detail="Please wait two minutes before requesting another verification email.")
    # At most five resend emails in any rolling four-hour window.
    if recent_count >= 5:
        raise HTTPException(status_code=429, detail="You have reached the limit of five resend attempts in four hours. Try again later.")

    # Only the newest link remains usable after a resend.
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.used_at.is_(None),
    ).update({EmailVerificationToken.used_at: now}, synchronize_session=False)
    token = VerificationService(db).create(user)
    try:
        send_verification_email(recipient=email, first_name=user.first_name, token=token)
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Email delivery is temporarily unavailable. Please try again later.") from exc
    db.commit()
    return {"message": "If the account needs verification, an email will be sent."}


@router.post("/login", response_model=SessionResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate_limit(request, "login", 20)
    email = str(data.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is not active; verify your email first")
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at.asc()))
    if membership is None or membership.organization.merchant_id is None:
        raise HTTPException(status_code=403, detail="Organization membership not found")
    provisioning = OrdiumProvisioningClient()
    try:
        (dashboard_test_id, dashboard_test_key), (dashboard_live_id, dashboard_live_key) = _dashboard_keys_for_user(db, user, provisioning, membership.organization.merchant_id)
    except OrdiumApiError as exc:
        raise HTTPException(status_code=503, detail="Unable to create dashboard session") from exc
    session, raw = create_session(db, user, dashboard_test_id, dashboard_test_key, dashboard_live_key)
    session.ordium_live_api_key_id = dashboard_live_id
    db.commit(); set_session_cookie(response, raw)
    return session_response(db, user, membership)

@router.patch("/account", response_model=SessionResponse)
def update_account(
    data: AccountSettingsUpdateRequest,
    session_data=Depends(get_current_session),
    db: Session = Depends(get_db),
):
    _session, user, membership = session_data
    organization = membership.organization

    # Email is deliberately absent from AccountSettingsUpdateRequest and is never
    # copied from client input. The account email is immutable.
    user.first_name = data.first_name.strip()
    user.last_name = data.last_name.strip()
    organization.name = data.organization_name.strip()
    organization.country = data.country.strip()
    organization.wilaya = data.wilaya.strip() if data.wilaya else None
    organization.city = data.city.strip() if data.city else None
    organization.website_url = str(data.website_url) if data.website_url else None
    organization.ecommerce_platform = data.ecommerce_platform.strip() if data.ecommerce_platform else None
    organization.business_type = data.business_type.strip() if data.business_type else None
    organization.primary_market = data.primary_market.strip() if data.primary_market else None
    organization.phone = data.phone.strip() if data.phone else None
    organization.monthly_orders = data.monthly_orders.strip() if data.monthly_orders else None
    db.commit()
    db.refresh(user)
    db.refresh(organization)
    return session_response(db, user, membership)


@router.post("/change-password", status_code=204)
def change_password(
    data: ChangePasswordRequest,
    response: Response,
    session_data=Depends(get_current_session),
    db: Session = Depends(get_db),
):
    _session, user, _membership = session_data
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")
    user.password_hash = hash_password(data.new_password)
    # Password changes invalidate all other browser sessions to limit the impact
    # of a compromised session. Keep the current session so the user is not logged out.
    now = datetime.now(timezone.utc)
    other_sessions = db.scalars(
        select(DbSession).where(
            DbSession.user_id == user.id,
            DbSession.id != _session.id,
            DbSession.revoked_at.is_(None),
        )
    ).all()
    for other_session in other_sessions:
        _revoke_session_dashboard_keys(db, other_session)
        other_session.revoked_at = now
    db.commit()
    return Response(status_code=204)



@router.get("/export")
def export_account(session_data=Depends(get_current_session), db: Session = Depends(get_db)):
    _session, user, membership = session_data
    org = membership.organization
    payload = {
        "export_version": "1",
        "user": {"id": str(user.id), "email": user.email, "first_name": user.first_name, "last_name": user.last_name, "status": user.status, "created_at": user.created_at.isoformat() if user.created_at else None},
        "organization": {"id": str(org.id), "name": org.name, "merchant_id": str(org.merchant_id) if org.merchant_id else None, "country": org.country, "wilaya": org.wilaya, "city": org.city, "website_url": org.website_url, "ecommerce_platform": org.ecommerce_platform, "business_type": org.business_type, "primary_market": org.primary_market, "phone": org.phone, "monthly_orders": org.monthly_orders},
        "membership": {"role": membership.role, "created_at": membership.created_at.isoformat() if membership.created_at else None},
        "sessions": [{"id": str(item.id), "created_at": item.created_at.isoformat(), "last_seen_at": item.last_seen_at.isoformat(), "expires_at": item.expires_at.isoformat(), "revoked": item.revoked_at is not None} for item in db.scalars(select(DbSession).where(DbSession.user_id == user.id)).all()],
    }
    return JSONResponse(payload, headers={"Content-Disposition": 'attachment; filename="ordium-account-export.json"'})


@router.get("/me", response_model=SessionResponse)
def me(request: Request, response: Response, session_data=Depends(get_current_session), db: Session = Depends(get_db)):
    _session, user, membership = session_data
    return session_response(db, user, membership)

@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(COOKIE_NAME)
    if raw:
        import hashlib
        from datetime import datetime, timezone
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        session = db.scalar(select(DbSession).where(DbSession.token_hash == token_hash))
        if session:
            # Only revoke the dashboard keys when no other live session of this
            # user still depends on them; otherwise logging out of one tab would
            # break every remaining session using the shared keys.
            if (session.ordium_api_key_id or session.ordium_live_api_key_id) and not _dashboard_keys_shared(db, session):
                try:
                    user = db.get(User, session.user_id)
                    membership = db.scalar(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at.asc())) if user else None
                    if membership and membership.organization.merchant_id:
                        provisioning = OrdiumProvisioningClient()
                        if session.ordium_api_key_id:
                            provisioning.revoke_api_key(membership.organization.merchant_id, session.ordium_api_key_id)
                        if session.ordium_live_api_key_id:
                            provisioning.revoke_api_key(membership.organization.merchant_id, session.ordium_live_api_key_id)
                except Exception:
                    # Local session revocation must not depend on the provisioning
                    # service being reachable. The browser cookie is still cleared;
                    # the external key revocation failure is logged for follow-up.
                    logger.exception("Failed to revoke dashboard API keys during logout")
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    clear_session_cookie(response)
    response.status_code = 204
    return response


@router.get("/sessions", response_model=list[SessionInfo])
def list_sessions(request: Request, session_data=Depends(get_current_session), db: Session = Depends(get_db)):
    current, user, _membership = session_data
    rows = db.scalars(select(DbSession).where(DbSession.user_id == user.id, DbSession.revoked_at.is_(None)).order_by(DbSession.last_seen_at.desc())).all()
    return [SessionInfo(id=row.id, created_at=row.created_at, last_seen_at=row.last_seen_at, expires_at=row.expires_at, current=row.id == current.id) for row in rows]

@router.post("/sessions/revoke-others", status_code=204)
def revoke_other_sessions(session_data=Depends(get_current_session), db: Session = Depends(get_db)):
    current, user, _membership = session_data
    from datetime import datetime, timezone
    rows = db.scalars(select(DbSession).where(DbSession.user_id == user.id, DbSession.id != current.id, DbSession.revoked_at.is_(None))).all()
    now = datetime.now(timezone.utc)
    for row in rows:
        _revoke_session_dashboard_keys(db, row)
        row.revoked_at = now
    db.commit(); return Response(status_code=204)

@router.post("/sessions/{session_id}/revoke", status_code=204)
def revoke_session(session_id: str, session_data=Depends(get_current_session), db: Session = Depends(get_db)):
    from uuid import UUID
    current, user, _membership = session_data
    try: target_id = UUID(session_id)
    except ValueError as exc: raise HTTPException(404, "Session not found") from exc
    if target_id == current.id:
        raise HTTPException(status_code=400, detail="Use logout to revoke the current session")
    target = db.scalar(select(DbSession).where(DbSession.id == target_id, DbSession.user_id == user.id, DbSession.revoked_at.is_(None)))
    if target is None: raise HTTPException(status_code=404, detail="Session not found")
    from datetime import datetime, timezone
    _revoke_session_dashboard_keys(db, target)
    target.revoked_at = datetime.now(timezone.utc); db.commit(); return Response(status_code=204)
