from fastapi import APIRouter, Depends
from app.api.dependencies import require_api_scope
from app.models.api_key import ApiKey
from app.schemas.risk_features import FeatureDefinitionResponse
from app.services.feature_registry import FeatureRegistry

router = APIRouter(prefix="/risk-features", tags=["Risk Features"])


@router.get("", response_model=list[FeatureDefinitionResponse])
def list_features(current: ApiKey = Depends(require_api_scope("risk_features:read"))):
    return FeatureRegistry.definitions()
