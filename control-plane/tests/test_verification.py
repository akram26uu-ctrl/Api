from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db import SessionLocal
from app.models.email_verification import EmailVerificationToken
from app.models.user import User
from app.services.verification import VerificationService


def test_verification_token_is_consumed_once():
    db = SessionLocal()
    user = User(
        email="verification-flow-test@example.invalid",
        password_hash="test-hash",
        first_name="Verification",
        last_name="Test",
        status="pending_verification",
    )
    try:
        db.add(user)
        db.flush()
        raw_token = VerificationService(db).create(user)
        db.commit()

        verified = VerificationService(db).consume(raw_token)
        assert verified is not None
        assert verified.id == user.id
        assert verified.status == "active"
        assert verified.email_verified_at is not None
        db.commit()

        # A replay must fail; the front end now avoids consuming tokens on page load.
        assert VerificationService(db).consume(raw_token) is None
    finally:
        db.rollback()
        db.delete(user)
        db.commit()
        db.close()


def test_expired_verification_token_is_rejected():
    db = SessionLocal()
    user = User(
        email="expired-verification-test@example.invalid",
        password_hash="test-hash",
        first_name="Expired",
        last_name="Test",
        status="pending_verification",
    )
    try:
        db.add(user)
        db.flush()
        raw_token = VerificationService(db).create(user)
        token_hash = VerificationService._hash(raw_token)
        row = db.scalar(select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash))
        assert row is not None
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

        assert VerificationService(db).consume(raw_token) is None
        assert user.status == "pending_verification"
    finally:
        db.rollback()
        db.delete(user)
        db.commit()
        db.close()
