from app.models.api_key import ApiKey
from app.models.merchant import Merchant
from app.services.api_key_service import ApiKeyService
from app.db.database import SessionLocal


def test_system_api_keys_are_distinguished_from_customer_keys():
    db = SessionLocal()
    try:
        merchant = Merchant(name="Visibility Merchant", email="visibility@example.com", status="active")
        db.add(merchant)
        db.flush()

        customer, _ = ApiKeyService(db).create_key(
        merchant,
        "Shopify Integration",
        "test",
        ["orders:write"],
        key_kind="customer",
    )
        system, _ = ApiKeyService(db).create_key(
        merchant,
        "Dashboard session (test)",
        "test",
        ["orders:write", "keys:manage"],
        key_kind="system",
    )
        db.commit()

        customer_rows = (
        db.query(ApiKey)
        .filter(ApiKey.merchant_id == merchant.id, ApiKey.environment == "test", ApiKey.key_kind == "customer")
        .all()
    )

        assert [row.id for row in customer_rows] == [customer.id]
        assert system.key_kind == "system"
    finally:
        db.close()
