from fastapi import APIRouter

from app.api.v1.risk_features import router as risk_features_router
from app.api.v1.audit import router as audit_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.api_keys import router as api_keys_router
from app.api.v1.orders import router as orders_router
from app.api.v1.order_confirmation_metrics import router as order_confirmation_metrics_router
from app.api.v1.order_outcomes import (
    router as order_outcomes_router,
)
from app.api.v1.risk_profile import router as risk_profile_router
from app.api.v1.risk_metrics import router as risk_metrics_router
from app.api.v1.identity_graph import router as identity_graph_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.stores import router as stores_router
from app.api.v1.usage import router as usage_router
from app.api.v1.integrations import router as integrations_router


router = APIRouter(
    prefix="/api/v1",
)

router.include_router(
    orders_router,
)
router.include_router(order_confirmation_metrics_router)

router.include_router(
    order_outcomes_router,
)

router.include_router(
    risk_profile_router,
)
router.include_router(risk_metrics_router)
router.include_router(identity_graph_router)
router.include_router(notifications_router)
router.include_router(stores_router)
router.include_router(usage_router)
router.include_router(api_keys_router)
router.include_router(webhooks_router)
router.include_router(audit_router)
router.include_router(risk_features_router)
router.include_router(integrations_router)
