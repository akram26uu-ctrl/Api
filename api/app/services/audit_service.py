from uuid import UUID
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.utils.json import to_json_safe


def _json_normalize(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_normalize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_normalize(v) for v in value]
    return value


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def record(
        self,
        *,
        action: str,
        resource_type: str,
        resource_id: str | UUID | None = None,
        merchant_id: UUID | None = None,
        api_key_id: UUID | None = None,
        environment: str | None = None,
        request_id: str | None = None,
        ip_address: str | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        # JSON columns must never receive Decimal values directly.
        # Some risk-score/config values can arrive from PostgreSQL as Decimal
        # depending on the active schema/driver, so normalize recursively.
        safe_metadata = to_json_safe(metadata) if metadata is not None else None
        if safe_metadata is not None:
            safe_metadata = _json_normalize(safe_metadata)

        entry = AuditLog(
            merchant_id=merchant_id,
            api_key_id=api_key_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            environment=environment,
            request_id=request_id,
            ip_address=ip_address,
            metadata_json=safe_metadata,
        )

        self.db.add(entry)
        self.db.flush()

        return entry
