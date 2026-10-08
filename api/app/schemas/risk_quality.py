from pydantic import BaseModel, Field


class RiskOperatingPoint(BaseModel):
    threshold: int = Field(ge=0, le=100)
    evaluated_orders: int = Field(ge=0)
    true_positives: int = Field(ge=0)
    false_positives: int = Field(ge=0)
    true_negatives: int = Field(ge=0)
    false_negatives: int = Field(ge=0)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    false_positive_rate: float = Field(ge=0, le=1)
    false_negative_rate: float = Field(ge=0, le=1)
    flag_rate: float = Field(ge=0, le=1)


class RiskQualityBucket(BaseModel):
    score_bucket: str
    evaluated_orders: int = Field(ge=0)
    bad_outcomes: int = Field(ge=0)
    bad_rate: float = Field(ge=0, le=1)
    sample_sufficient: bool


class RiskSignalPairQuality(BaseModel):
    event_type_a: str
    event_type_b: str
    evaluated_orders: int = Field(ge=0)
    bad_outcomes: int = Field(ge=0)
    bad_rate: float = Field(ge=0, le=1)
    support_rate: float = Field(ge=0, le=1)
    jaccard_overlap: float = Field(ge=0, le=1)
    average_combined_score_impact: float = Field(ge=0)
    sample_sufficient: bool
    high_overlap: bool


class RiskSignalQuality(BaseModel):
    event_type: str
    evaluated_orders: int = Field(ge=0)
    bad_outcomes: int = Field(ge=0)
    bad_rate: float = Field(ge=0, le=1)
    support_rate: float = Field(ge=0, le=1)
    lift_vs_baseline: float | None = Field(default=None, ge=0)
    sample_sufficient: bool




class RiskSignalAttribution(BaseModel):
    event_type: str
    triggered_orders: int = Field(ge=0)
    bad_outcomes: int = Field(ge=0)
    bad_rate: float = Field(ge=0, le=1)
    total_score_impact: int = Field(ge=0)
    average_score_impact: float = Field(ge=0)
    average_raw_order_score: float = Field(ge=0)
    score_contribution_share: float = Field(ge=0, le=1)
    sample_sufficient: bool


class RiskAttributionResponse(BaseModel):
    evaluated_orders: int = Field(ge=0)
    total_raw_event_score: int = Field(ge=0)
    total_final_score: int = Field(ge=0)
    capped_orders: int = Field(ge=0)
    capped_order_rate: float = Field(ge=0, le=1)
    total_capped_score_loss: int = Field(ge=0)
    dominant_signal_orders: int = Field(ge=0)
    dominant_signal_rate: float = Field(ge=0, le=1)
    strongly_dominant_signal_orders: int = Field(ge=0)
    strongly_dominant_signal_rate: float = Field(ge=0, le=1)
    minimum_samples: int = Field(ge=1)
    signals: list[RiskSignalAttribution] = Field(default_factory=list)


class RiskQualityResponse(BaseModel):
    evaluated_orders: int = Field(ge=0)
    overall_bad_rate: float = Field(ge=0, le=1)
    minimum_samples: int = Field(ge=1)
    review_threshold: int = Field(ge=0, le=100)
    reject_threshold: int = Field(ge=0, le=100)
    review_operating_point: RiskOperatingPoint
    reject_operating_point: RiskOperatingPoint
    score_buckets: list[RiskQualityBucket] = Field(default_factory=list)
    monotonicity_violations: list[str] = Field(default_factory=list)
    signals: list[RiskSignalQuality] = Field(default_factory=list)
    signal_pairs: list[RiskSignalPairQuality] = Field(default_factory=list)
    overlap_threshold: float = Field(ge=0, le=1)


class RiskBacktestOperatingPoint(BaseModel):
    threshold: int = Field(ge=0, le=100)
    evaluated_orders: int = Field(ge=0)
    true_positives: int = Field(ge=0)
    false_positives: int = Field(ge=0)
    true_negatives: int = Field(ge=0)
    false_negatives: int = Field(ge=0)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    false_positive_rate: float = Field(ge=0, le=1)
    false_negative_rate: float = Field(ge=0, le=1)
    flag_rate: float = Field(ge=0, le=1)
    f1_score: float = Field(ge=0, le=1)


class RiskThresholdCandidate(BaseModel):
    review_threshold: int = Field(ge=0, le=100)
    reject_threshold: int = Field(ge=0, le=100)
    operating_point: RiskBacktestOperatingPoint


class RiskWeightCandidate(BaseModel):
    event_type: str
    multiplier: float = Field(gt=0, le=2)
    evaluated_orders: int = Field(ge=0)
    changed_orders: int = Field(ge=0)
    average_score_delta: float
    operating_point: RiskBacktestOperatingPoint
    improves_f1: bool
    guardrails_pass: bool
    advisory: bool = True


class RiskBacktestResponse(BaseModel):
    replay_mode: str
    evaluated_orders: int = Field(ge=0)
    minimum_samples: int = Field(ge=1)
    baseline: RiskBacktestOperatingPoint
    threshold_candidates: list[RiskThresholdCandidate]
    weight_candidates: list[RiskWeightCandidate]
    calibration_recommendations: list[str]
    changes_applied: bool = False
