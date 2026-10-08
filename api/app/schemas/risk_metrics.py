from pydantic import BaseModel, Field


class RiskPerformanceResponse(BaseModel):
    evaluated_orders: int = Field(ge=0)
    true_positives: int = Field(ge=0)
    false_positives: int = Field(ge=0)
    true_negatives: int = Field(ge=0)
    false_negatives: int = Field(ge=0)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    detection_rate: float = Field(ge=0, le=1)
    false_positive_rate: float = Field(ge=0, le=1)
    false_negative_rate: float = Field(ge=0, le=1)
    flag_rate: float = Field(ge=0, le=1)


class RiskScoreBucket(BaseModel):
    score_bucket: str
    evaluated_orders: int = Field(ge=0)
    bad_outcomes: int = Field(ge=0)
    bad_rate: float = Field(ge=0, le=1)


class RiskCalibrationResponse(RiskPerformanceResponse):
    score_buckets: list[RiskScoreBucket] = Field(default_factory=list)
    calibration_ready: bool = False
    minimum_orders_per_bucket: int = Field(default=50, ge=1)
    recommended_review_threshold: int | None = Field(default=None, ge=0, le=100)
    recommended_reject_threshold: int | None = Field(default=None, ge=0, le=100)
