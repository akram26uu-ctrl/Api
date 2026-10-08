from uuid import uuid4

from app.db.database import SessionLocal
from app.models.merchant import Merchant
from app.models.enums import MerchantStatus
from app.repositories.merchant_repository import MerchantRepository


def test_create_and_read_merchant():
    db = SessionLocal()

    try:
        repository = MerchantRepository(db)

        email = f"test-{uuid4()}@example.com"

        merchant = Merchant(
            name="Test Merchant",
            email=email,
            status=MerchantStatus.ACTIVE,
        )

        repository.create(merchant)

        db.commit()

        saved_merchant = repository.get_by_email(email)

        assert saved_merchant is not None
        assert saved_merchant.email == email
        assert saved_merchant.name == "Test Merchant"

        print("Merchant CRUD test passed.")
        print(f"Merchant ID: {saved_merchant.id}")

    finally:
        db.close()


if __name__ == "__main__":
    test_create_and_read_merchant()