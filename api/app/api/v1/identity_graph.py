from collections import defaultdict, deque

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.models.order import Order
from app.models.risk_assessment import RiskAssessment
from app.api.store_scope import requested_store_id

router = APIRouter(prefix="/identity-graph", tags=["Identity Graph"])


def _risk_level(score: int) -> str:
    if score >= 80:
        return "danger"
    if score >= 50:
        return "warning"
    return "safe"


@router.get("")
def get_identity_graph(
    limit: int = Query(default=250, ge=1, le=1000),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:read")),
):
    selected_store = requested_store_id(db, api_key, store_id)
    orders = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.phone_identifier),
        joinedload(Order.device_identifier),
        joinedload(Order.address_identifier),
        selectinload(Order.risk_assessments),
    ).filter(
        Order.merchant_id == api_key.merchant_id,
        Order.environment == api_key.environment,
    )
    if selected_store is not None:
        orders = orders.filter(Order.store_id == selected_store)
    orders = orders.order_by(Order.created_at.desc()).limit(limit).all()

    nodes: dict[str, dict] = {}
    edges: dict[str, dict] = {}
    adjacency: dict[str, set[str]] = defaultdict(set)

    def add_node(node_id: str, node_type: str, label: str, value: str, score: int = 0, metadata: dict | None = None):
        current = nodes.get(node_id)
        if current is None:
            nodes[node_id] = {
                "id": node_id, "type": node_type, "label": label, "value": value,
                "risk_level": _risk_level(score), "connected_count": 0,
                "metadata": metadata or {}, "risk_score": score,
            }
        elif score > current["risk_score"]:
            current["risk_score"] = score
            current["risk_level"] = _risk_level(score)

    def connect(source: str, target: str, label: str, confidence: float = 1.0, risk_weight: float = 0.0):
        edge_id = f"{source}|{target}|{label}"
        if edge_id in edges:
            return
        edges[edge_id] = {"id": edge_id, "source": source, "target": target, "label": label, "confidence": confidence, "risk_weight": risk_weight}
        adjacency[source].add(target)
        adjacency[target].add(source)

    for order in orders:
        assessments = sorted(order.risk_assessments or [], key=lambda item: item.created_at or 0)
        assessment = assessments[-1] if assessments else None
        score = int(assessment.score) if assessment else 0
        order_id = f"order:{order.id}"
        add_node(order_id, "order", order.external_order_id, order.external_order_id, score, {"created_at": order.created_at.isoformat() if order.created_at else None})

        entity_specs = []
        if order.customer:
            name = f"{order.customer.first_name} {order.customer.last_name}".strip()
            entity_specs.append((f"customer:{order.customer.id}", "customer", name, str(order.customer.id), "customer", 1.0))
        if order.phone_identifier:
            entity_specs.append((f"phone:{order.phone_identifier.id}", "phone", order.phone_identifier.phone, order.phone_identifier.phone, "uses", 1.0))
        if order.device_identifier:
            entity_specs.append((f"device:{order.device_identifier.id}", "device", order.device_identifier.fingerprint[:16] + "…", str(order.device_identifier.id), "uses", 0.95))
        if order.address_identifier:
            entity_specs.append((f"address:{order.address_identifier.id}", "address", f"{order.address_identifier.commune}, {order.address_identifier.wilaya}", str(order.address_identifier.id), "ships_to", 0.95))
        if order.ip_address:
            entity_specs.append((f"ip:{order.ip_address}", "ip", order.ip_address, order.ip_address, "originates_from", 0.9))

        for node_id, node_type, label, value, relation, confidence in entity_specs:
            add_node(node_id, node_type, label, value, score)
            connect(order_id, node_id, relation, confidence, score / 100)

    for node_id, neighbors in adjacency.items():
        if node_id in nodes:
            nodes[node_id]["connected_count"] = len(neighbors)

    # Connected components are the graph's actual clusters. A component with
    # multiple customer nodes or a high-risk order is surfaced as suspicious.
    seen: set[str] = set()
    suspicious: list[str] = []
    cluster_count = 0
    for start in nodes:
        if start in seen:
            continue
        cluster_count += 1
        queue = deque([start]); seen.add(start); members = []
        while queue:
            current = queue.popleft(); members.append(current)
            for nxt in adjacency.get(current, set()):
                if nxt not in seen:
                    seen.add(nxt); queue.append(nxt)
        customer_count = sum(1 for item in members if nodes[item]["type"] == "customer")
        max_score = max((nodes[item]["risk_score"] for item in members), default=0)
        cluster_id = f"cluster:{cluster_count}"
        for member in members:
            nodes[member]["cluster_id"] = cluster_id
        if customer_count >= 2 or max_score >= 80:
            suspicious.append(cluster_id)

    for node in nodes.values():
        node.pop("risk_score", None)

    return {
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "clusters_detected": cluster_count,
        "suspicious_cluster_ids": suspicious,
    }
