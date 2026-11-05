"""Poll carriers for the tracking of in-flight shipments.

Run periodically (the compose webhook-worker loop calls it every 30 minutes)."""
from __future__ import annotations

import logging

from app.db.database import SessionLocal
from app.services.tracking_service import TrackingService

logger = logging.getLogger("ordium.sync_shipments")


def main() -> dict[str, int]:
    with SessionLocal() as db:
        counts = TrackingService(db).sync_active(commit=db.commit)
        db.commit()
    if any(counts.values()):
        logger.info("shipment sync: %s", counts)
        print(counts)
    return counts


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
