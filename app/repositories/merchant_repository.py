from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.merchant import Merchant


class MerchantRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, merchant_id: UUID) -> Merchant | None:
        statement = select(Merchant).where(
            Merchant.id == merchant_id,
        )

        return self.db.scalar(statement)

    def get_by_email(self, email: str) -> Merchant | None:
        statement = select(Merchant).where(
            Merchant.email == email,
        )

        return self.db.scalar(statement)

    def create(self, merchant: Merchant) -> Merchant:
        self.db.add(merchant)
        self.db.flush()
