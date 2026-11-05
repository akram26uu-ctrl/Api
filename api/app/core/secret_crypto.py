import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def fernet() -> Fernet:
    """Fernet derived from settings.secret_key; shared by webhook secrets and carrier credentials."""
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode("utf-8")).digest())
    return Fernet(key)
