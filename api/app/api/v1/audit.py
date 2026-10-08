from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("audit:read"))):
    entries = AuditLogRepository(db).list_for_merchant(current.merchant_id, environment=current.environment)
    return [AuditLogResponse(id=str(e.id), action=e.action, resource_type=e.resource_type, resource_id=e.resource_id, environment=e.environment, request_id=e.request_id, created_at=e.created_at, metadata=e.metadata_json) for e in entries]
