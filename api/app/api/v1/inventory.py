from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.api.store_scope import requested_store_id
from app.models.api_key import ApiKey
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.order import Order
from app.models.product import Product, ProductCarrierLink, StockDeposit, StockLevel, StockMovement
from app.models.shipment import Shipment
from app.models.store import Store
from app.schemas.inventory import (
    DepositCreate, DepositResponse, DepositStatusUpdate, MovementPage, ProductCreate, ProductLinkCreate,
    ProductResponse, ProductUpdate, StockRow, UnmappedProduct,
)
from app.services.carrier_account_service import CarrierAccountService
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])
DEPOSIT_ORDER = {"in_transit": 0, "counting": 1, "received": 2}


def _store_ids(db: Session, api_key: ApiKey, store_id: str | None) -> list[UUID]:
    selected = requested_store_id(db, api_key, store_id)
    if selected is not None:
        return [selected]
    return [row[0] for row in db.query(Store.id).filter(Store.merchant_id == api_key.merchant_id)]


def _write_store(db: Session, api_key: ApiKey, store_id: str | None) -> UUID:
    selected = requested_store_id(db, api_key, store_id)
    if selected is None:
        raise HTTPException(422, "store_id_required")
    return selected


def _get_product(db: Session, api_key: ApiKey, product_id: str, store_id: str | None) -> Product:
    try:
        parsed = UUID(product_id)
    except ValueError as exc:
        raise HTTPException(404, "Product not found") from exc
    product = db.query(Product).filter(
        Product.id == parsed, Product.merchant_id == api_key.merchant_id,
        Product.store_id.in_(_store_ids(db, api_key, store_id))).first()
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


def _get_account(db: Session, api_key: ApiKey, account_id: UUID, store: UUID) -> CarrierAccount:
    account = db.query(CarrierAccount).filter(
        CarrierAccount.id == account_id, CarrierAccount.merchant_id == api_key.merchant_id,
        CarrierAccount.environment == api_key.environment, CarrierAccount.store_id == store).first()
    if account is None:
        raise HTTPException(404, "Carrier account not found")
    return account


@router.get("/products", response_model=list[ProductResponse])
def list_products(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                  api_key: ApiKey = Depends(require_api_scope("inventory:read"))):
    return db.query(Product).filter(
        Product.merchant_id == api_key.merchant_id, Product.store_id.in_(_store_ids(db, api_key, store_id))
    ).order_by(Product.created_at.asc(), Product.sku.asc()).all()


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                   api_key: ApiKey = Depends(require_api_scope("inventory:write"))):
    selected = _write_store(db, api_key, store_id)
    service = InventoryService(db)
    sku = data.sku.strip()
    if not service.normalize_sku(sku):
        raise HTTPException(422, "sku_required")
    if service.find_by_sku(selected, sku) is not None:
        raise HTTPException(409, "sku_already_exists")
    product = Product(merchant_id=api_key.merchant_id, store_id=selected, sku=sku, name=data.name.strip(),
                      fulfillment=data.fulfillment, weight_grams=data.weight_grams)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products/unmapped", response_model=list[UnmappedProduct])
def unmapped_products(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                      api_key: ApiKey = Depends(require_api_scope("inventory:read"))):
    from app.models.order_item import OrderItem
    rows = db.query(OrderItem.sku, OrderItem.product_name).join(Order, Order.id == OrderItem.order_id).join(
        Shipment, Shipment.order_id == Order.id).filter(
        Shipment.merchant_id == api_key.merchant_id, Shipment.environment == api_key.environment,
        Shipment.hold_reason == "unmapped_product", Shipment.store_id.in_(_store_ids(db, api_key, store_id))).all()
    service = InventoryService(db)
    known = {s: service._products_by_sku(s) for s in _store_ids(db, api_key, store_id)}
    seen: dict = {}
    for sku, name in rows:
        key = service.normalize_sku(sku)
        if key and any(key in by_sku for by_sku in known.values()):
            continue
        seen.setdefault((key, name if key is None else None), UnmappedProduct(sku=key, name=name))
    return list(seen.values())


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: str, data: ProductUpdate, store_id: str | None = Query(default=None),
                   db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("inventory:write"))):
    product = _get_product(db, api_key, product_id, store_id)
    if data.name is not None:
        product.name = data.name.strip()
    if data.fulfillment is not None:
        product.fulfillment = data.fulfillment
    if "weight_grams" in data.model_fields_set:
        product.weight_grams = data.weight_grams
    db.commit()
    db.refresh(product)
    return product


@router.post("/products/{product_id}/links", status_code=status.HTTP_201_CREATED)
def link_product(product_id: str, data: ProductLinkCreate, store_id: str | None = Query(default=None),
                 db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("inventory:write"))):
    product = _get_product(db, api_key, product_id, store_id)
    account = _get_account(db, api_key, data.carrier_account_id, product.store_id)
    link = db.query(ProductCarrierLink).filter_by(product_id=product.id, carrier_account_id=account.id).first()
    if link is None:
        link = ProductCarrierLink(product_id=product.id, carrier_account_id=account.id,
                                  external_product_id=data.external_product_id)
        db.add(link)
    else:
        link.external_product_id = data.external_product_id
    db.commit()
    return {"product_id": product.id, "carrier_account_id": account.id, "external_product_id": data.external_product_id}


@router.get("/stock", response_model=list[StockRow])
def list_stock(store_id: str | None = Query(default=None), refresh: int = Query(default=0),
               db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("inventory:read"))):
    selected = requested_store_id(db, api_key, store_id)
    service = InventoryService(db)
    if refresh == 1 and selected is not None:
        service.refresh_store(selected, api_key.environment, CarrierAccountService(db).adapter_for)
        db.commit()
    stores = _store_ids(db, api_key, store_id)
    products = db.query(Product).filter(
        Product.merchant_id == api_key.merchant_id, Product.store_id.in_(stores)).order_by(Product.sku.asc()).all()
    ids = [p.id for p in products]
    levels: dict = {}
    if ids:
        rows = db.query(StockLevel, CarrierWarehouse.name, CarrierAccount.environment).outerjoin(
            CarrierWarehouse, CarrierWarehouse.id == StockLevel.warehouse_id).outerjoin(
            CarrierAccount, CarrierAccount.id == CarrierWarehouse.carrier_account_id).filter(
            StockLevel.product_id.in_(ids)).all()
        for level, wh_name, env in rows:
            if level.warehouse_id is not None and env != api_key.environment:
                continue
            levels.setdefault(level.product_id, []).append((level, wh_name))
    linked = {row[0] for row in db.query(ProductCarrierLink.product_id).filter(ProductCarrierLink.product_id.in_(ids))} if ids else set()
    result = []
    for p in products:
        locs = sorted(levels.get(p.id, []), key=lambda x: x[1] or "")
        on_hand = sum(l.on_hand for l, _ in locs)
        reserved = sum(l.reserved for l, _ in locs)
        inbound = sum(l.inbound for l, _ in locs)
        available = on_hand - reserved
        low = service.is_low(p) if p.fulfillment == "carrier" else False
        if p.fulfillment == "merchant":
            state = "merchant"
        elif p.id not in linked:
            state = "unmapped"
        elif available <= 0:
            state = "out"
        elif low:
            state = "low"
        else:
            state = "ok"
        result.append({
            "product_id": p.id, "store_id": p.store_id, "sku": p.sku, "name": p.name, "fulfillment": p.fulfillment,
            "locations": [{"warehouse_id": l.warehouse_id, "warehouse_name": n, "on_hand": l.on_hand,
                           "reserved": l.reserved, "inbound": l.inbound} for l, n in locs],
            "total_on_hand": on_hand, "total_reserved": reserved, "total_inbound": inbound,
            "total_available": available, "is_low": low, "status": state,
        })
    return result


def _deposit_query(db: Session, api_key: ApiKey, stores: list[UUID]):
    return db.query(StockDeposit).join(CarrierAccount, CarrierAccount.id == StockDeposit.carrier_account_id).filter(
        StockDeposit.merchant_id == api_key.merchant_id, CarrierAccount.environment == api_key.environment,
        CarrierAccount.store_id.in_(stores))


@router.get("/deposits", response_model=list[DepositResponse])
def list_deposits(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                  api_key: ApiKey = Depends(require_api_scope("inventory:read"))):
    return _deposit_query(db, api_key, _store_ids(db, api_key, store_id)).order_by(StockDeposit.created_at.desc()).all()


@router.post("/deposits", response_model=DepositResponse, status_code=status.HTTP_201_CREATED)
def create_deposit(data: DepositCreate, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                   api_key: ApiKey = Depends(require_api_scope("inventory:write"))):
    selected = _write_store(db, api_key, store_id)
    account = _get_account(db, api_key, data.carrier_account_id, selected)
    if data.warehouse_id is not None and db.query(CarrierWarehouse.id).filter(
            CarrierWarehouse.id == data.warehouse_id, CarrierWarehouse.carrier_account_id == account.id).first() is None:
        raise HTTPException(404, "Warehouse not found")
    deposit = StockDeposit(merchant_id=api_key.merchant_id, carrier_account_id=account.id,
                           warehouse_id=data.warehouse_id, reference=data.reference.strip(), status="in_transit",
                           lines=[line.model_dump() for line in data.lines])
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


@router.post("/deposits/{deposit_id}/status", response_model=DepositResponse)
def update_deposit_status(deposit_id: str, data: DepositStatusUpdate, store_id: str | None = Query(default=None),
                          db: Session = Depends(get_database),
                          api_key: ApiKey = Depends(require_api_scope("inventory:write"))):
    try:
        parsed = UUID(deposit_id)
    except ValueError as exc:
        raise HTTPException(404, "Deposit not found") from exc
    deposit = _deposit_query(db, api_key, _store_ids(db, api_key, store_id)).filter(StockDeposit.id == parsed).first()
    if deposit is None:
        raise HTTPException(404, "Deposit not found")
    if DEPOSIT_ORDER[data.status] <= DEPOSIT_ORDER[deposit.status]:
        raise HTTPException(409, "invalid_deposit_transition")
    if data.status == "received":
        InventoryService(db).receive_deposit(deposit)
    else:
        deposit.status = data.status
    db.commit()
    db.refresh(deposit)
    return deposit


@router.get("/movements", response_model=MovementPage)
def list_movements(store_id: str | None = Query(default=None), page: int = Query(default=1, ge=1),
                   limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_database),
                   api_key: ApiKey = Depends(require_api_scope("inventory:read"))):
    query = db.query(StockMovement).join(Product, Product.id == StockMovement.product_id).outerjoin(
        CarrierWarehouse, CarrierWarehouse.id == StockMovement.warehouse_id).outerjoin(
        CarrierAccount, CarrierAccount.id == CarrierWarehouse.carrier_account_id).filter(
        Product.merchant_id == api_key.merchant_id, Product.store_id.in_(_store_ids(db, api_key, store_id)),
        or_(StockMovement.warehouse_id.is_(None), CarrierAccount.environment == api_key.environment))
    total = query.count()
    rows = query.order_by(StockMovement.occurred_at.desc(), StockMovement.id.desc()).offset(
        (page - 1) * limit).limit(limit).all()
    return {"data": rows, "pagination": {"total": total, "page": page, "limit": limit,
                                         "total_pages": (total + limit - 1) // limit if total else 1}}
