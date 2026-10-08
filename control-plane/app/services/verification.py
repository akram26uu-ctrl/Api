import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.email_verification import EmailVerificationToken
from app.models.user import User

class VerificationService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def create(self, user: User) -> str:
        raw = secrets.token_urlsafe(32)
        token = EmailVerificationToken(
            user_id=user.id,
            token_hash=self._hash(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        self.db.add(token)
        self.db.flush()
        return raw

    def consume(self, raw: str) -> User | None:
        token = self.db.scalar(select(EmailVerificationToken).where(EmailVerificationToken.token_hash == self._hash(raw), EmailVerificationToken.used_at.is_(None)))
        if token is None:
            return None
        expires_at = token.expires_at if token.expires_at.tzinfo else token.expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return None
        user = self.db.get(User, token.user_id)
        if user is None:
            return None
        token.used_at = datetime.now(timezone.utc)
        user.status = "active"
        user.email_verified_at = datetime.now(timezone.utc)
        return user
