from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.models.notification import Notification
from app.api.store_scope import requested_store_id
from app.schemas.notification import NotificationPage, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _serialize(item: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=str(item.id),
        environment=item.environment,
        store_id=str(item.store_id) if item.store_id else None,
        notification_type=item.notification_type,
        severity=item.severity,
        title=item.title,
        message=item.message,
        resource_type=item.resource_type,
        resource_id=item.resource_id,
        metadata=item.metadata_json,
        read_at=item.read_at,
        created_at=item.created_at,
    )


@router.get("", response_model=NotificationPage)
def list_notifications(
    limit: int = Query(default=25, ge=1, le=100),
    unread_only: bool = Query(default=False),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("orders:read")),
):
    selected_store = requested_store_id(db, current, store_id)
    base = db.query(Notification).filter(Notification.merchant_id == current.merchant_id, Notification.environment == current.environment)
    if selected_store is not None:
        base = base.filter(Notification.store_id == selected_store)
    unread_count = base.filter(Notification.read_at.is_(None)).count()
    query = base
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    items = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return NotificationPage(
        data=[_serialize(item) for item in items],
        unread_count=unread_count,
        pagination={"total": base.count(), "limit": limit},
    )


@router.post("/read-all", response_model=dict)
def mark_all_notifications_read(
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("orders:read")),
):
    from datetime import datetime, timezone
    selected_store = requested_store_id(db, current, store_id)
    filters = [
        Notification.merchant_id == current.merchant_id,
        Notification.environment == current.environment,
        Notification.read_at.is_(None),
    ]
    if selected_store is not None:
        filters.append(Notification.store_id == selected_store)
    updated = db.query(Notification).filter(*filters).update(
        {Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False
    )
    db.commit()
    return {"updated": int(updated)}

@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: UUID,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("orders:read")),
):
    selected_store = requested_store_id(db, current, store_id)
    item = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.merchant_id == current.merchant_id,
        Notification.environment == current.environment,
        *( [Notification.store_id == selected_store] if selected_store is not None else [] ),
    ).first()
    if item is None:
        from fastapi import HTTPException
        raise HTTPException(404, "Notification not found")
    if item.read_at is None:
        from datetime import datetime, timezone
        item.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(item)
    return _serialize(item)

