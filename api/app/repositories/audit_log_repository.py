from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


class AuditLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_merchant(self, merchant_id: UUID, environment: str, limit: int = 100) -> list[AuditLog]:
        return list(self.db.scalars(
            select(AuditLog)
            .where(AuditLog.merchant_id == merchant_id, AuditLog.environment == environment)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        ))
