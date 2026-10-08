from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RiskDecision, RiskEventType


class RiskEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_type: RiskEventType
    score_impact: int
    event_data: dict | None = None


class RiskExplanationResponse(BaseModel):
    risk_signal_count: int = 0
    identity_cluster_size: int = 0
    identity_confidence: int = 0
    identity_match_reasons: list[str] = Field(default_factory=list)
    business_context: dict = Field(default_factory=dict)


class RiskAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assessment_id: str
    score: int = Field(ge=0, le=100)
    decision: RiskDecision
    model_version: str
    rules_version: str
    risk_profile_version: int
    execution_time_ms: float | None = None
    explanation: RiskExplanationResponse | None = None
    events: list[RiskEventResponse]
