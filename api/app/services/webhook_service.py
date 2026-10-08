import base64
import hashlib
import ipaddress
import socket
from urllib.parse import urlparse
import hmac
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.webhook_delivery import WebhookDelivery
from app.models.webhook_endpoint import WebhookEndpoint


class WebhookService:
    ALLOWED_EVENTS = {"*", "order.risk_assessed", "order.outcome.updated"}

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def validate_url(url: str, *, resolve: bool = False) -> str | None:
        parsed = urlparse(url)
        if parsed.scheme != "https" and settings.environment.strip().lower() == "production":
            raise ValueError("Webhook URL must use HTTPS in production")
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("Invalid webhook URL")
        if parsed.username is not None or parsed.password is not None or parsed.fragment:
            raise ValueError("Webhook URL must not contain userinfo or fragments")
        host = parsed.hostname
        try:
            literal_ip = ipaddress.ip_address(host)
        except ValueError:
            literal_ip = None
        if literal_ip is not None:
            if not literal_ip.is_global:
                raise ValueError("Webhook URL resolves to a forbidden network address")
            return str(literal_ip) if resolve else None
        if not resolve:
            return None
        try:
            addresses = sorted({
                item[4][0]
                for item in socket.getaddrinfo(
                    host,
                    parsed.port or (443 if parsed.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            })
        except OSError as exc:
            raise ValueError("Webhook hostname could not be resolved") from exc
        if not addresses:
            raise ValueError("Webhook hostname could not be resolved")
        for address in addresses:
            ip = ipaddress.ip_address(address)
            if not ip.is_global:
                raise ValueError("Webhook URL resolves to a forbidden network address")
        return addresses[0]

    @staticmethod
    def _fernet() -> Fernet:
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode("utf-8")).digest())
        return Fernet(key)

    @classmethod
    def _encrypt_secret(cls, secret: str) -> bytes:
        return cls._fernet().encrypt(secret.encode("utf-8"))

    @classmethod
    def _decrypt_secret(cls, encrypted: bytes) -> str:
        return cls._fernet().decrypt(encrypted).decode("utf-8")

    def create_endpoint(self, merchant_id: UUID, environment: str, url: str, events: list[str], store_id: UUID | None = None) -> tuple[WebhookEndpoint, str]:
        self.validate_url(url, resolve=True)
        if store_id is None:
            from app.models.store import Store
            store = self.db.query(Store).filter(Store.merchant_id == merchant_id, Store.is_active.is_(True)).order_by(Store.created_at.asc()).first()
            if store is not None:
                store_id = store.id
        if not events or any(event not in self.ALLOWED_EVENTS for event in events):
            raise ValueError("Unsupported webhook event")
        secret = f"whsec_{secrets.token_urlsafe(32)}"
        endpoint = WebhookEndpoint(
            merchant_id=merchant_id,
            store_id=store_id,
            environment=environment,
            url=url,
            signing_secret_encrypted=self._encrypt_secret(secret),
            events=events,
            is_active=True,
        )
        self.db.add(endpoint)
        self.db.flush()
        return endpoint, secret

    def validate_delivery_target(self, url: str) -> str:
        """Validate and return a public IP pinned for this delivery attempt."""
        resolved_ip = self.validate_url(url, resolve=True)
        if resolved_ip is None:
            raise ValueError("Webhook hostname could not be resolved")
        return resolved_ip

    def enqueue(self, merchant_id: UUID, environment: str, event_type: str, payload: dict, store_id: UUID | None = None) -> list[WebhookDelivery]:
        event_id = uuid4()
        deliveries: list[WebhookDelivery] = []
        endpoints = self.db.scalars(
            select(WebhookEndpoint).where(
                WebhookEndpoint.merchant_id == merchant_id,
                WebhookEndpoint.environment == environment,
                *( [(WebhookEndpoint.store_id == store_id)] if store_id is not None else [] ),
                WebhookEndpoint.is_active.is_(True),
            )
        ).all()
        for endpoint in endpoints:
            events = endpoint.events or []
            if events and event_type not in events and "*" not in events:
                continue
            delivery = WebhookDelivery(
                endpoint_id=endpoint.id,
                environment=environment,
                event_id=event_id,
                event_type=event_type,
                payload=payload,
                status="pending",
                attempts=0,
            )
            self.db.add(delivery)
            deliveries.append(delivery)
        self.db.flush()
        return deliveries

    def sign(self, endpoint: WebhookEndpoint, payload: dict, timestamp: int | None = None) -> str:
        timestamp = timestamp or int(datetime.now(timezone.utc).timestamp())
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        body = f"{timestamp}.{raw}".encode("utf-8")
        secret = self._decrypt_secret(endpoint.signing_secret_encrypted)
        digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        return f"t={timestamp},v1={digest}"
