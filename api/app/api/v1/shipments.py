from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.api.store_scope import requested_store_id
from app.models.api_key import ApiKey
from app.models.carrier_account import CarrierAccount
from app.models.enums import OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.risk_assessment import RiskAssessment
from app.models.shipment import Shipment, ShipmentEvent
from app.schemas.shipping import ShipmentCreate
from app.services.audit_service import AuditService
from app.services.carrier_account_service import CarrierAccountService
from app.services.dispatch_service import DispatchService
from app.services.shipping_service import ShipmentActionRefused, ShippingService

router = APIRouter(prefix="/shipping", tags=["Shipping"])

DEFAULT_PICKUP_TIME = "14:00"
STATUS_GROUPS = {
    "ready": ("pending_dispatch", "accepted"),
    "transit": ("picked_up", "in_transit"),
    "out": ("out_for_delivery", "delivery_attempt_failed"),
    "done": ("delivered",),
    "ret": ("returning", "returned"),
    "fail": ("dispatch_failed",),
}
LISTED_STATUSES = tuple(s for group in STATUS_GROUPS.values() for s in group)
NEEDS_DECISION = (RiskDecision.REVIEW, RiskDecision.REJECT)


def scoped_shipments(db: Session, api_key: ApiKey, store_id: str | None):
    selected = requested_store_id(db, api_key, store_id)
    query = db.query(Shipment).filter(
        Shipment.merchant_id == api_key.merchant_id, Shipment.environment == api_key.environment)
    if selected is not None:
        query = query.filter(Shipment.store_id == selected)
    return query, selected


def get_shipment(db: Session, api_key: ApiKey, shipment_id: str, store_id: str | None) -> Shipment:
    try:
        parsed = UUID(shipment_id)
    except ValueError as exc:
        raise HTTPException(404, "Shipment not found") from exc
    query, _ = scoped_shipments(db, api_key, store_id)
    shipment = query.filter(Shipment.id == parsed).first()
    if shipment is None:
        raise HTTPException(404, "Shipment not found")
    return shipment


def latest_assessment(db: Session, order_id: UUID) -> RiskAssessment | None:
    return db.query(RiskAssessment).filter(RiskAssessment.order_id == order_id).order_by(
        RiskAssessment.created_at.desc(), RiskAssessment.id.desc()).first()


def customer_name(order: Order | None) -> str | None:
    return f"{order.first_name} {order.last_name}".strip() if order is not None else None


def wilaya_of(order: Order | None) -> str | None:
    return order.address_identifier.wilaya if order is not None and order.address_identifier is not None else None


def shipment_dict(shipment: Shipment, order: Order | None = None, carrier_code: str | None = None) -> dict:
    return {
        "id": str(shipment.id), "order_id": str(shipment.order_id), "store_id": str(shipment.store_id) if shipment.store_id else None,
        "environment": shipment.environment,
        "carrier_account_id": str(shipment.carrier_account_id) if shipment.carrier_account_id else None,
        "carrier_code": carrier_code,
        "warehouse_id": str(shipment.warehouse_id) if shipment.warehouse_id else None,
        "fulfillment": shipment.fulfillment, "status": shipment.status, "hold_reason": shipment.hold_reason,
        "tracking_number": shipment.tracking_number, "label_url": shipment.label_url,
        "cod_amount": shipment.cod_amount, "delivery_type": shipment.delivery_type, "attempts": shipment.attempts,
        "next_attempt_at": shipment.next_attempt_at, "last_error": shipment.last_error,
        "dispatched_at": shipment.dispatched_at, "delivered_at": shipment.delivered_at,
        "created_at": shipment.created_at, "updated_at": shipment.updated_at,
        "meta": shipment.meta or {},
        "external_order_id": order.external_order_id if order is not None else None,
        "customer_name": customer_name(order), "wilaya": wilaya_of(order),
        "currency": order.currency if order is not None else None,
    }


def _audit(db: Session, api_key: ApiKey, action: str, shipment: Shipment, **meta) -> None:
    AuditService(db).record(
        action=action, resource_type="shipment", resource_id=shipment.id, merchant_id=api_key.merchant_id,
        api_key_id=api_key.id, environment=api_key.environment, metadata={"order_id": str(shipment.order_id), **meta})


def _hold_detail(shipment: Shipment) -> str:
    return "order_needs_decision" if shipment.hold_reason in ("review", "rejected") else shipment.hold_reason


@router.get("/shipments")
def list_shipments(
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, max_length=50),
    q: str | None = Query(default=None, max_length=255),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("shipping:read")),
):
    base, _ = scoped_shipments(db, api_key, store_id)
    # Held pending shipments live on the pending-decision page, not here.
    base = base.join(Order, Order.id == Shipment.order_id).filter(
        Shipment.status.in_(LISTED_STATUSES),
        or_(Shipment.status != "pending_dispatch", Shipment.hold_reason.is_(None)))
    if source:
        base = base.filter(Order.source == source)
    if q:
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        term = f"%{escaped}%"
        base = base.filter(or_(
            Order.external_order_id.ilike(term, escape="\\"), Shipment.tracking_number.ilike(term, escape="\\"),
            Order.first_name.ilike(term, escape="\\"), Order.last_name.ilike(term, escape="\\"),
            (Order.first_name + " " + Order.last_name).ilike(term, escape="\\")))
    by_status = dict(base.with_entities(Shipment.status, func.count(Shipment.id)).group_by(Shipment.status).all())
    counts = {"all": sum(by_status.values())}
    for name, statuses in STATUS_GROUPS.items():
        counts[name] = sum(by_status.get(s, 0) for s in statuses)
    query = base
    if status_filter and status_filter != "all":
        statuses = STATUS_GROUPS.get(status_filter, (status_filter,))
        query = query.filter(Shipment.status.in_(statuses))
    total = query.count()
    rows = query.order_by(Shipment.created_at.desc(), Shipment.id.desc()).offset((page - 1) * limit).limit(limit).all()
    carriers = {a.id: a.carrier_code for a in db.query(CarrierAccount).filter(
        CarrierAccount.id.in_({s.carrier_account_id for s in rows if s.carrier_account_id}))} if rows else {}
    orders = {o.id: o for o in db.query(Order).filter(Order.id.in_({s.order_id for s in rows}))} if rows else {}
    return {
        "data": [shipment_dict(s, orders.get(s.order_id), carriers.get(s.carrier_account_id)) for s in rows],
        "counts": counts,
        "pagination": {"total": total, "page": page, "limit": limit,
                       "total_pages": (total + limit - 1) // limit if total else 1},
    }


@router.get("/shipments/{shipment_id}")
def shipment_detail(shipment_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                    api_key: ApiKey = Depends(require_api_scope("shipping:read"))):
    shipment = get_shipment(db, api_key, shipment_id, store_id)
    order = db.get(Order, shipment.order_id)
    account = db.get(CarrierAccount, shipment.carrier_account_id) if shipment.carrier_account_id else None
    events = db.query(ShipmentEvent).filter(ShipmentEvent.shipment_id == shipment.id).order_by(
        ShipmentEvent.occurred_at.desc(), ShipmentEvent.id.desc()).all()
    data = shipment_dict(shipment, order, account.carrier_code if account else None)
    data["events"] = [
        {"id": str(e.id), "status": e.status, "raw_status": e.raw_status, "location": e.location,
         "occurred_at": e.occurred_at, "source": e.source} for e in events]
    data["allocations"] = shipment.allocations or []
    data["order"] = None if order is None else {
        "id": str(order.id), "external_order_id": order.external_order_id, "customer_name": customer_name(order),
        "wilaya": wilaya_of(order), "total_amount": order.total_amount, "currency": order.currency,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "phone": order.phone_identifier.phone if order.phone_identifier else None,
        "items": [{"product_name": i.product_name, "sku": i.sku, "quantity": i.quantity,
                   "unit_price": i.unit_price} for i in order.items],
    }
    return data


def _respond(db: Session, shipment: Shipment, outcome: str) -> dict:
    db.refresh(shipment)
    order = db.get(Order, shipment.order_id)
    account = db.get(CarrierAccount, shipment.carrier_account_id) if shipment.carrier_account_id else None
    return {"shipment": shipment_dict(shipment, order, account.carrier_code if account else None), "outcome": outcome}


def order_approved(db: Session, order_id: UUID) -> dict | None:
    """The merchant's approval recorded on any shipment of this order (any status)."""
    for (meta,) in db.query(Shipment.meta).filter(Shipment.order_id == order_id).all():
        if isinstance(meta, dict) and meta.get("merchant_approved"):
            return meta["merchant_approved"]
    return None


def _dispatch_now(db: Session, api_key: ApiKey, shipment: Shipment, action: str) -> dict:
    """Dispatch a shipment that has no hold, then commit. Held shipments never get here."""
    locked = db.query(Shipment).filter(Shipment.id == shipment.id).with_for_update().populate_existing().first()
    if locked is None:
        raise HTTPException(404, "Shipment not found")
    shipment = locked
    if shipment.hold_reason is not None:
        db.commit()
        raise HTTPException(409, _hold_detail(shipment))
    try:
        with db.begin_nested():
            outcome = DispatchService(db).dispatch_one(shipment, "manual")
    except Exception as exc:
        db.commit()  # savepoint already rolled back; keep earlier work (e.g. a freshly created row)
        raise HTTPException(502, "dispatch_error") from exc
    if outcome != "skipped":
        _audit(db, api_key, action, shipment, outcome=outcome)
    db.commit()
    return _respond(db, shipment, outcome)


@router.post("/shipments")
def create_shipment(data: ShipmentCreate, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                    api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    selected = requested_store_id(db, api_key, store_id)
    query = db.query(Order).filter(
        Order.id == data.order_id, Order.merchant_id == api_key.merchant_id, Order.environment == api_key.environment)
    if selected is not None:
        query = query.filter(Order.store_id == selected)
    order = query.first()
    if order is None:
        raise HTTPException(404, "Order not found")
    service = ShippingService(db)
    shipment = service.active_shipment(order.id)
    if shipment is None:
        if order.status == OrderStatus.CANCELLED:
            raise HTTPException(409, "order_cancelled")
        assessment = latest_assessment(db, order.id)
        if assessment is None:
            raise HTTPException(409, "order_needs_decision")  # fail closed
        approved = order_approved(db, order.id)
        decision = assessment.decision
        needs_decision = decision in NEEDS_DECISION and approved is None
        shipment = service.on_decision(order, db.get(Merchant, order.merchant_id),
                                       decision if needs_decision or approved is None else RiskDecision.ALLOW)
        if shipment is None:
            first = CarrierAccountService(db).first_linked_at(order.store_id, order.environment) if order.store_id else None
            predates = first is not None and _aware(order.created_at) < _aware(first)
            raise HTTPException(409, "order_predates_carrier_link" if predates else "no_carrier_configured")
        if approved is not None and not needs_decision:
            service._set_meta(shipment, merchant_approved=approved)
        if needs_decision:
            db.commit()  # the held shipment appears on the pending page
            raise HTTPException(409, "order_needs_decision")
    if shipment.hold_reason is not None:
        detail = _hold_detail(shipment)
        db.commit()  # keep a freshly created held shipment visible on the pending page
        raise HTTPException(409, detail)
    return _dispatch_now(db, api_key, shipment, "shipment.dispatch")


def _aware(value):
    from datetime import timezone
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


@router.post("/shipments/{shipment_id}/retry")
def retry_shipment(shipment_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                   api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    old = get_shipment(db, api_key, shipment_id, store_id)
    if old.status != "dispatch_failed":
        raise HTTPException(409, f"Shipment is {old.status}")
    order = db.get(Order, old.order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    service = ShippingService(db)
    if service.active_shipment(order.id) is not None:
        raise HTTPException(409, "active_shipment_exists")
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(409, "order_cancelled")
    assessment = latest_assessment(db, order.id)
    approved = order_approved(db, order.id)
    if assessment is None or (assessment.decision in NEEDS_DECISION and approved is None):
        raise HTTPException(409, "order_needs_decision")
    new_id = uuid4()
    new = Shipment(
        id=new_id, merchant_id=old.merchant_id, store_id=old.store_id, order_id=old.order_id,
        environment=old.environment, status="pending_dispatch", idempotency_key=str(new_id),
        carrier_account_id=old.carrier_account_id, cod_amount=old.cod_amount, delivery_type=old.delivery_type,
        allocations=[], meta={"merchant_approved": approved} if approved else {}, hold_reason=None,
        next_attempt_at=None)
    try:
        with db.begin_nested():
            db.add(new)
            db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "active_shipment_exists") from exc
    service.allocate_and_reserve(new)
    if new.hold_reason is not None:
        detail = _hold_detail(new)
        db.commit()
        raise HTTPException(409, detail)
    return _dispatch_now(db, api_key, new, "shipment.retry")


@router.post("/shipments/{shipment_id}/cancel")
def cancel_shipment(shipment_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                    api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    shipment = get_shipment(db, api_key, shipment_id, store_id)
    try:
        ShippingService(db).cancel_shipment(shipment, api_key.id)
    except ShipmentActionRefused as exc:
        raise HTTPException(409, str(exc)) from exc
    if shipment.status != "cancelled":
        db.commit()  # keep the carrier error / notification recorded
        raise HTTPException(409, "carrier_cancel_failed")
    db.commit()
    db.refresh(shipment)
    return shipment_dict(shipment, db.get(Order, shipment.order_id))


@router.get("/next-pickups")
def next_pickups(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                 api_key: ApiKey = Depends(require_api_scope("shipping:read"))):
    selected = requested_store_id(db, api_key, store_id)
    query = db.query(CarrierAccount).filter(
        CarrierAccount.merchant_id == api_key.merchant_id, CarrierAccount.environment == api_key.environment,
        CarrierAccount.status == "active")
    if selected is not None:
        query = query.filter(CarrierAccount.store_id == selected)
    accounts = query.order_by(CarrierAccount.created_at.asc()).all()
    shipments, _ = scoped_shipments(db, api_key, store_id)
    counts = {(account_id, fulfillment): n for account_id, fulfillment, n in shipments.filter(
        Shipment.status == "accepted", Shipment.carrier_account_id.isnot(None)).with_entities(
        Shipment.carrier_account_id, Shipment.fulfillment, func.count(Shipment.id)).group_by(
        Shipment.carrier_account_id, Shipment.fulfillment).all()}
    return {"data": [
        {"carrier_account_id": str(a.id), "carrier_code": a.carrier_code, "display_name": a.display_name,
         "pickup_time": DEFAULT_PICKUP_TIME,
         "merchant_parcels": counts.get((a.id, "merchant"), 0), "warehouse_parcels": counts.get((a.id, "carrier"), 0)}
        for a in accounts]}
