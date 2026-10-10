import hashlib
import json
from decimal import Decimal
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID
import re
import unicodedata
from app.utils.json import to_json_safe
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.address_identifier import AddressIdentifier
from app.models.api_key import ApiKey
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import OrderStatus
from app.models.idempotency_record import IdempotencyRecord
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.notification import Notification
from app.repositories.address_identifier_repository import AddressIdentifierRepository
from app.repositories.device_identifier_repository import DeviceIdentifierRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.risk_assessment_repository import RiskAssessmentRepository
from app.schemas.order import OrderCreate
from app.services.identity_service import IdentityService
from app.services.risk_service import RiskResult, RiskService
from app.services.audit_service import AuditService
from app.services.webhook_service import WebhookService
from app.services.identity_graph_service import IdentityGraphService
from app.core.business_context import normalize_category
from app.core.config import settings
from app.services.usage_service import enforce_live_quota


@dataclass
class OrderCreationResult:
    order: Order
    risk_result: RiskResult
    response_body: dict
    replayed: bool = False


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.order_repository = OrderRepository(db)
        self.identity_service = IdentityService(db)
        self.device_repository = DeviceIdentifierRepository(db)
        self.address_repository = AddressIdentifierRepository(db)
        self.risk_service = RiskService(db)
        self.idempotency_repository = IdempotencyRepository(db)
        self.assessment_repository = RiskAssessmentRepository(db)
        self.audit_service = AuditService(db)
        self.webhook_service = WebhookService(db)
        self.graph_service = IdentityGraphService(db)

    def create_order(
        self,
        merchant_id: UUID,
        data: OrderCreate,
        api_key: ApiKey | None = None,
        store_id: UUID | None = None,
        idempotency_key: str | None = None,
        device_fingerprint: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> OrderCreationResult:
        environment = api_key.environment if api_key else "live"
        data_origin = "test" if environment == "test" else "real"
        # A key may be merchant-scoped without being restricted to one store.
        # In that case, preserve the store selected by the request (query/header).
        if api_key is not None and api_key.store_id is not None:
            store_id = api_key.store_id
        if api_key is not None and api_key.store_id is None and store_id is not None:
            from app.models.store import Store
            valid_store = self.db.query(Store).filter(Store.id == store_id, Store.merchant_id == merchant_id, Store.is_active.is_(True)).first()
            if valid_store is None:
                raise ValueError("Store not found")
        if store_id is None:
            raise ValueError("store_id is required")
        request_hash = self._request_hash(data, device_fingerprint)

        try:
            if idempotency_key is not None:
                idempotency_key = idempotency_key.strip()
                if not idempotency_key or len(idempotency_key) > 255:
                    raise ValueError("Invalid Idempotency-Key")

                now = datetime.now(timezone.utc)
                self.idempotency_repository.delete_expired_for_merchant(
                    merchant_id,
                    environment,
                    now,
                )
                existing = self.idempotency_repository.get(merchant_id, environment, idempotency_key)
                if existing is not None:
                    # A record without a committed order is stale/incomplete. This can
                    # happen after an interrupted request and must not permanently
                    # block the same simulator key with HTTP 409.
                    if existing.order_id is None:
                        self.db.delete(existing)
                        self.db.flush()
                        existing = None
                    else:
                        return self._replay_or_reject(existing, request_hash)

                try:
                    self.idempotency_repository.create(
                        IdempotencyRecord(
                            response_body={},
                            merchant_id=merchant_id,
                            environment=environment,
                            api_key_id=api_key.id if api_key else None,
                            idempotency_key=idempotency_key,
                            request_hash=request_hash,
                            status_code=201,
                            expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.idempotency_ttl_seconds),
                        )
                    )
                except IntegrityError:
                    self.db.rollback()
                    existing = self.idempotency_repository.get(merchant_id, environment, idempotency_key)
                    if existing is None:
                        raise
                    return self._replay_or_reject(existing, request_hash)

            if environment == "live":
                enforce_live_quota(self.db, merchant_id)

            existing_order = self.order_repository.get_by_external_id(
                merchant_id=merchant_id,
                external_order_id=data.external_order_id,
                environment=environment,
                store_id=store_id,
            )
            if existing_order is not None:
                raise ValueError("An order with this external order number already exists")

            identity = self.identity_service.resolve_customer(
                merchant_id=merchant_id,
                first_name=data.first_name,
                last_name=data.last_name,
                phone=data.phone,
            )

            device_identifier_id = None
            if device_fingerprint:
                device = self.device_repository.get_by_fingerprint(device_fingerprint)
                if device is None:
                    device = DeviceIdentifier(fingerprint=device_fingerprint)
                    self.device_repository.create(device)
                device_identifier_id = device.id

            normalized_address = self._normalize_address(data.address, data.commune, data.wilaya)
            address_hash = self._hash_address(normalized_address)
            address = self.address_repository.get_by_hash(address_hash)
            if address is None:
                address = AddressIdentifier(
                    normalized_address=normalized_address,
                    wilaya=data.wilaya,
                    commune=data.commune,
                    address_hash=address_hash,
                )
                self.address_repository.create(address)

            order = Order(
                merchant_id=merchant_id,
                store_id=store_id,
                api_key_id=api_key.id if api_key else None,
                customer_id=identity.customer.id,
                phone_identifier_id=identity.phone_identifier.id,
                device_identifier_id=device_identifier_id,
                address_identifier_id=address.id,
                external_order_id=data.external_order_id,
                environment=environment,
                data_origin=data_origin,
                status=OrderStatus.PENDING,
                total_amount=data.total_amount,
                currency=data.currency,
                first_name=data.first_name,
                last_name=data.last_name,
                ip_address=ip_address,
                user_agent=user_agent,
                source="api",
                identity_confidence=identity.confidence,
                identity_match_reasons=list(identity.match_reasons),
            )
            try:
                self.order_repository.create(order)
                self.db.flush()
                if data.items:
                    self.db.add_all([
                        OrderItem(
                            order_id=order.id,
                            product_name=item.product_name,
                            sku=item.sku,
                            product_category=item.product_category,
                            product_category_normalized=normalize_category(item.product_category) if item.product_category else None,
                            quantity=item.quantity,
                            unit_price=item.unit_price,
                        )
                        for item in data.items
                    ])
                    self.db.flush()
            except IntegrityError as exc:
                self.db.rollback()
                raise ValueError("An order with this external order number already exists") from exc

            risk_result = self.risk_service.assess_order(order)
            graph_summary = self.graph_service.summarize_order(order)

            response_body = to_json_safe(self._build_response_body(order, risk_result, graph_summary))

            if idempotency_key is not None:
                record = self.idempotency_repository.get(merchant_id, environment, idempotency_key)
                if record is None:
                    raise RuntimeError("Idempotency record disappeared")
                record.order_id = order.id
                record.response_body = response_body
                record.status_code = 201

            self.audit_service.record(
                action="order.created", resource_type="order", resource_id=order.id,
                merchant_id=merchant_id, api_key_id=api_key.id if api_key else None,
                environment=environment, metadata={"decision": risk_result.decision.value, "score": str(risk_result.score) if isinstance(risk_result.score, Decimal) else risk_result.score},
            )
            self.webhook_service.enqueue(
                merchant_id, environment, "order.risk_assessed",
                {"order_id": str(order.id), "external_order_id": order.external_order_id, "environment": environment, "risk": response_body["risk"]},
                store_id=store_id,
            )
            # Persist only actionable risk notifications. They are created in the
            # same transaction as the order/risk assessment so the dashboard never
            # shows an alert for an order that failed to commit.
            # التحقق مما إذا كان التاجر في وضع الظل (Shadow Mode)
            is_shadow_mode = merchant.is_shadow_mode_enabled if hasattr(merchant, 'is_shadow_mode_enabled') else False

            # إذا كان في وضع الظل، نغير قرار الحظر إلى مجرد مراجعة
            if is_shadow_mode and risk_result.decision.value == "reject":
                risk_result.decision.value = "review"

            if risk_result.decision.value in {"review", "reject"}:
                severity = "critical" if risk_result.decision.value == "reject" else "warning"
                title = "Order blocked by risk engine" if severity == "critical" else "Order requires review"
                message = (
                    f"Order {order.external_order_id} received a risk score of {risk_result.score} "
                    f"and was marked {risk_result.decision.value.upper()}."
                )
                self.db.add(Notification(
                    merchant_id=merchant_id,
                    store_id=store_id,
                    environment=environment,
                    notification_type=f"order.risk.{risk_result.decision.value}",
                    severity=severity,
                    title=title,
                    message=message,
                    resource_type="order",
                    resource_id=str(order.id),
                    metadata_json={
                        "order_id": str(order.id),
                        "external_order_id": order.external_order_id,
                        "score": risk_result.score,
                        "decision": risk_result.decision.value,
                        "signal_count": len(risk_result.events),
                    },
                ))
            self.db.commit()
            self.db.refresh(order)
            return OrderCreationResult(
                order=order,
                risk_result=risk_result,
                response_body=response_body,
                replayed=False,
            )
        except Exception:
            self.db.rollback()
            raise

    def _replay_or_reject(
        self,
        record: IdempotencyRecord,
        request_hash: str,
    ) -> OrderCreationResult:
        if record.request_hash != request_hash:
            raise ValueError("Idempotency-Key was already used with a different request")
        if record.order_id is None or not record.response_body:
            raise ValueError("Idempotent request is still processing")

        order = self.order_repository.get_by_context(
            record.order_id,
            merchant_id=record.merchant_id,
            environment=record.environment,
        )
        if order is None:
            raise ValueError("Idempotent order no longer exists")

        assessment = self.assessment_repository.get_latest_for_order(order.id)
        if assessment is None:
            raise ValueError("Idempotent risk assessment is unavailable")

        return OrderCreationResult(
            order=order,
            risk_result=RiskResult(
                score=assessment.score,
                decision=assessment.decision,
                assessment=assessment,
                events=list(assessment.events),
            ),
            response_body=record.response_body,
            replayed=True,
        )

    @staticmethod
    def _build_response_body(order: Order, risk_result: RiskResult, graph_summary: dict | None = None) -> dict:
        return {
            "order_id": str(order.id),
            "external_order_id": order.external_order_id,
            "status": order.status.value,
            "environment": order.environment,
            "risk": {
                "assessment_id": str(risk_result.assessment.id),
                "score": risk_result.score,
                "decision": risk_result.decision.value,
                "model_version": risk_result.assessment.model_version,
                "rules_version": risk_result.assessment.rules_version,
                "risk_profile_version": risk_result.assessment.risk_profile_version,
                "execution_time_ms": risk_result.assessment.execution_time_ms,
                "explanation": {
                    "risk_signal_count": len(risk_result.events),
                    "identity_cluster_size": (graph_summary or {}).get("identity_cluster_size", 0),
                    "identity_confidence": order.identity_confidence,
                    "identity_match_reasons": order.identity_match_reasons,
                    "business_context": {
                        "merchant_category": normalize_category(order.merchant.primary_business_category if order.merchant else None),
                        "item_count": len(order.items),
                        "total_quantity": sum(item.quantity for item in order.items),
                        "distinct_categories": sorted({item.product_category_normalized for item in order.items if item.product_category_normalized}),
                        "items_subtotal": str(sum((item.line_total for item in order.items), Decimal("0"))),
                    },
                },
                "events": [
                    {
                        "event_type": event.event_type.value,
                        "score_impact": event.score_impact,
                        "event_data": event.event_data,
                    }
                    for event in risk_result.events
                ],
            },
            "items": [
                {
                    "id": str(item.id),
                    "product_name": item.product_name,
                    "sku": item.sku,
                    "product_category": item.product_category,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "line_total": item.line_total,
                }
                for item in order.items
            ],
        }

    @staticmethod
    def _request_hash(data: OrderCreate, device_fingerprint: str | None) -> str:
        payload = {
            "order": data.model_dump(mode="json"),
            "device_fingerprint": device_fingerprint,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @staticmethod
    def _normalize_address(address: str, commune: str, wilaya: str) -> str:
        value = unicodedata.normalize("NFKC", f"{address}, {commune}, {wilaya}").casefold()
        value = "".join(ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch))
        value = re.sub(r"[^\w\s,]", " ", value, flags=re.UNICODE)
        value = re.sub(r"\s*,\s*", ",", value)
        value = re.sub(r"\s+", " ", value).strip(" ,")
        return value

    @staticmethod
    def _hash_address(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()
