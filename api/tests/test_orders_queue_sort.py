"""Orders work queue: ?sort=risk returns riskiest first (then oldest)."""
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.risk_assessment import RiskAssessment
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def _payload(i):
    return {"external_order_id": f"Q-{uuid4()}", "first_name": f"Queue{chr(65+i)}", "last_name": "Buyer",
            "phone": f"05551{i:05d}", "wilaya": "Oran", "commune": "Oran", "address": f"{i} Rue",
            "total_amount": "3000.00", "currency": "DZD"}


def test_sort_by_risk_orders_by_score_desc():
    db = SessionLocal()
    try:
        merchant = Merchant(name="Queue", email=f"queue-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant); db.flush()
        _, raw = ApiKeyService(db).create_key(merchant=merchant, name="q", environment="live", scopes=["orders:read", "orders:write"])
        db.commit()
        headers = {"Authorization": f"Bearer {raw}"}
        ids = [client.post("/api/v1/orders", json=_payload(i), headers=headers).json()["order_id"] for i in range(3)]
        for order_id, score in zip(ids, (10, 90, 40)):
            assessment = db.query(RiskAssessment).filter(RiskAssessment.order_id == UUID(order_id)).first()
            assessment.score = score
        db.commit()
        risk = client.get("/api/v1/orders?sort=risk", headers=headers).json()["data"]
        assert [o["order_id"] for o in risk] == [ids[1], ids[2], ids[0]]
        newest = client.get("/api/v1/orders", headers=headers).json()["data"]
        assert newest[0]["order_id"] == ids[2]
        assert client.get("/api/v1/orders?sort=bogus", headers=headers).status_code == 422
    finally:
        db.close()
