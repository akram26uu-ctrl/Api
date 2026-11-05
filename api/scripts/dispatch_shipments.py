"""Dispatch due shipments to their carriers.

Run periodically (the compose webhook-worker loop calls it every ~10 s). Two
housekeeping passes are gated by timestamp files so they do not run every loop:
confirmation expiry (every 5 minutes) and stock-hold re-evaluation (every 10 minutes)."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from app.db.database import SessionLocal
from app.services.dispatch_service import DispatchService
from app.services.shipping_service import ShippingService

logger = logging.getLogger("ordium.dispatch")

STAMP_DIR = Path(os.environ.get("ORDIUM_WORKER_STAMP_DIR", "/tmp"))
EXPIRE_EVERY_SECONDS = 300
REEVALUATE_EVERY_SECONDS = 600


def _due(name: str, every: int, now: float | None = None) -> bool:
    """True when the pass ``name`` last ran ``every`` seconds ago or more (or never)."""
    now = time.time() if now is None else now
    try:
        last = float((STAMP_DIR / name).read_text().strip() or 0)
    except (OSError, ValueError):
        last = 0.0
    return now - last >= every


def _stamp(name: str, now: float | None = None) -> None:
    try:
        (STAMP_DIR / name).write_text(str(time.time() if now is None else now))
    except OSError:
        logger.warning("could not write worker stamp %s", name)


def housekeeping(db, now: float | None = None) -> dict[str, int]:
    done: dict[str, int] = {}
    if _due("ordium_expire_unconfirmed.ts", EXPIRE_EVERY_SECONDS, now):
        done["expired"] = ShippingService(db).expire_unconfirmed()
        db.commit()
        _stamp("ordium_expire_unconfirmed.ts", now)
    if _due("ordium_reevaluate_holds.ts", REEVALUATE_EVERY_SECONDS, now):
        service = ShippingService(db)
        released = 0
        for store_id, environment in service.stores_with_stock_holds():
            try:
                with db.begin_nested():
                    released += service.reevaluate_store_holds(store_id, environment)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("hold re-evaluation failed for store %s", store_id)
        done["reevaluated"] = released
        _stamp("ordium_reevaluate_holds.ts", now)
    return done


def main() -> dict[str, int]:
    with SessionLocal() as db:
        extra = housekeeping(db)
        counts = DispatchService(db).run_batch(commit=db.commit, expire=False)
        db.commit()
    if any(counts.values()) or any(extra.values()):
        logger.info("shipment dispatch: %s %s", counts, extra)
        print({**counts, **extra})
    return counts


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
