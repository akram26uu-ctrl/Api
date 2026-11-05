"""Import carrier-held stock for every active carrier account.

Run periodically (the compose webhook-worker loop calls it every 60 minutes)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.database import SessionLocal
from app.models.carrier_account import CarrierAccount
from app.services.carrier_account_service import CarrierAccountService
from app.services.inventory_service import InventoryService

logger = logging.getLogger("ordium.sync_inventory")


def run(db, commit=None) -> dict[str, int]:
    counts = {"synced": 0, "errors": 0}
    ids = list(db.scalars(select(CarrierAccount.id).where(CarrierAccount.status == "active")))
    for account_id in ids:
        account = db.get(CarrierAccount, account_id)
        if account is None or account.status != "active":
            continue
        try:
            with db.begin_nested():
                stock = CarrierAccountService(db).adapter_for(account).list_stock()
                InventoryService(db).import_carrier_stock(account, stock)
            account.last_sync_at = datetime.now(timezone.utc)
            account.last_error = None
            counts["synced"] += 1
        except Exception as exc:  # one failing account must not stop the others
            logger.warning("inventory sync failed account=%s: %s", account_id, exc)
            account.last_error = f"{exc.__class__.__name__}: {exc}"[:500]
            counts["errors"] += 1
        if commit is not None:
            commit()
    db.flush()
    return counts


def main() -> dict[str, int]:
    with SessionLocal() as db:
        counts = run(db, commit=db.commit)
        db.commit()
    if any(counts.values()):
        logger.info("inventory sync: %s", counts)
        print(counts)
    return counts


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
