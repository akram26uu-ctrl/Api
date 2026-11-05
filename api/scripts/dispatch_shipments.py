"""Dispatch due shipments to their carriers.

Run periodically (the compose webhook-worker loop calls it)."""
from __future__ import annotations

import logging

from app.db.database import SessionLocal
from app.services.dispatch_service import DispatchService

logger = logging.getLogger("ordium.dispatch")


def main() -> dict[str, int]:
    with SessionLocal() as db:
        counts = DispatchService(db).run_batch(commit=db.commit)
        db.commit()
    if any(counts.values()):
        logger.info("shipment dispatch: %s", counts)
        print(counts)
    return counts


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
