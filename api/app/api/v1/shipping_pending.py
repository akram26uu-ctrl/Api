from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.api.v1.shipments import (
    customer_name, get_shipment, latest_assessment, scoped_shipments, shipment_dict, wilaya_of,
)
from app.models.api_key import ApiKey
from app.models.shipment import Shipment
from app.models.order import Order
from app.schemas.shipping import DispatchFromRequest
from app.services.shipping_service import ShipmentActionRefused, ShippingService

router = APIRouter(prefix="/shipping/pending", tags=["Shipping"])

REASON_HOLDS = {
    "review": ("review", "no_answer", "unmapped_product", "mixed_source", "no_store"),
    "stock": ("out_of_stock",),
    "rejected": ("rejected",),
}
ALL_PENDING_HOLDS = tuple(h for holds in REASON_HOLDS.values() for h in holds)


def _item(db: Session, service: ShippingService, shipment) -> dict:
    order = db.get(Order, shipment.order_id)
    assessment = latest_assessment(db, shipment.order_id)
    events = sorted(assessment.events, key=lambda e: abs(e.score_impact), reverse=True)[:3] if assessment else []
    return {
        "shipment_id": str(shipment.id), "order_id": str(shipment.order_id),
        "external_order_id": order.external_order_id if order else None,
        "customer_name": customer_name(order), "wilaya": wilaya_of(order),
        "cod_amount": shipment.cod_amount, "currency": order.currency if order else None,
        "created_at": shipment.created_at, "hold_reason": shipment.hold_reason,
        "risk_score": assessment.score if assessment else None,
        "risk_decision": assessment.decision.value if assessment else None,
        "reasons": [e.event_type.value for e in events],
        "available_warehouses": [
            {"id": str(w.id), "carrier_account_id": str(w.carrier_account_id), "name": w.name,
             "wilaya_code": w.wilaya_code}
            for w in service.available_warehouses(shipment)] if shipment.hold_reason == "out_of_stock" else [],
    }


@router.get("")
def list_pending(
    reason: str | None = Query(default=None, pattern="^(review|stock|rejected)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("shipping:read")),
):
    base, _ = scoped_shipments(db, api_key, store_id)
    base = base.filter(Shipment.status == "pending_dispatch", Shipment.hold_reason.in_(ALL_PENDING_HOLDS))
    counts = {name: base.filter(Shipment.hold_reason.in_(holds)).count() for name, holds in REASON_HOLDS.items()}
    query = base.filter(Shipment.hold_reason.in_(REASON_HOLDS[reason])) if reason else base
    total = query.count()
    rows = query.order_by(Shipment.created_at.desc(), Shipment.id.desc()).offset((page - 1) * limit).limit(limit).all()
    service = ShippingService(db)
    return {
        "data": [_item(db, service, s) for s in rows], "counts": counts,
        "pagination": {"total": total, "page": page, "limit": limit,
                       "total_pages": (total + limit - 1) // limit if total else 1},
    }


def _act(db: Session, api_key: ApiKey, shipment_id: str, store_id: str | None, call):
    shipment = get_shipment(db, api_key, shipment_id, store_id)
    try:
        call(ShippingService(db), shipment)
    except ShipmentActionRefused as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(shipment)
    return shipment_dict(shipment, db.get(Order, shipment.order_id))


def _simple(action: str):
    def endpoint(shipment_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                 api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
        return _act(db, api_key, shipment_id, store_id, lambda svc, sh: getattr(svc, action)(sh, api_key.id))
    endpoint.__name__ = f"pending_{action}"
    return endpoint


for _action in ("approve", "reject", "restore", "archive"):
    router.add_api_route(f"/{{shipment_id}}/{_action}", _simple(_action), methods=["POST"])


@router.post("/{shipment_id}/dispatch-from")
def dispatch_from(shipment_id: str, data: DispatchFromRequest, store_id: str | None = Query(default=None),
                  db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    shipment = get_shipment(db, api_key, shipment_id, store_id)
    if shipment.hold_reason != "out_of_stock":
        raise HTTPException(409, "not_out_of_stock")
    return _act(db, api_key, shipment_id, store_id,
                lambda svc, sh: svc.dispatch_from(sh, data.warehouse_id, api_key.id))
