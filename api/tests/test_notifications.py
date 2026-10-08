from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.notification import Notification
from app.models.store import Store
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def _merchant_and_key(scopes=None):
    db = SessionLocal()
    merchant = Merchant(
        name="Notification Merchant",
        email=f"notifications-{uuid4()}@ordium.local",
        status=MerchantStatus.ACTIVE,
    )
    db.add(merchant)
    db.flush()
    store = Store(merchant_id=merchant.id, name="Notification Store", slug=f"notification-{uuid4()}", is_active=True)
    db.add(store)
    db.flush()
    _, raw = ApiKeyService(db).create_key(
        merchant,
        "Notification Dashboard",
        "test",
        scopes or ["orders:read"],
    )
    db.commit()
    db.close()
    return merchant.id, store.id, raw


def test_notifications_are_merchant_and_environment_scoped():
    merchant_id, store_id, raw = _merchant_and_key()
    db = SessionLocal()
    try:
        db.add_all([
            Notification(
                merchant_id=merchant_id,
                environment="test",
                store_id=store_id,
                notification_type="order.risk.reject",
                severity="critical",
                title="Order blocked by risk engine",
                message="Order TEST-1 was rejected.",
            ),
            Notification(
                merchant_id=merchant_id,
                environment="live",
                store_id=store_id,
                notification_type="order.risk.reject",
                severity="critical",
                title="LIVE alert",
                message="Should not be visible in TEST.",
            ),
        ])
        db.commit()
    finally:
        db.close()

    response = client.get(f"/api/v1/notifications?store_id={store_id}", headers={"Authorization": f"Bearer {raw}"})
    assert response.status_code == 200
    body = response.json()
    assert body["unread_count"] == 1
    assert len(body["data"]) == 1
    assert body["data"][0]["environment"] == "test"


def test_notifications_can_be_marked_read():
    merchant_id, store_id, raw = _merchant_and_key()
    db = SessionLocal()
    try:
        item = Notification(
            merchant_id=merchant_id,
            store_id=store_id,
            environment="test",
            notification_type="order.risk.review",
            severity="warning",
            title="Order requires review",
            message="Order TEST-2 requires review.",
        )
        db.add(item)
        db.commit()
        notification_id = item.id
    finally:
        db.close()

    response = client.post(
        f"/api/v1/notifications/{notification_id}/read?store_id={store_id}",
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert response.status_code == 200
    assert response.json()["read_at"] is not None
