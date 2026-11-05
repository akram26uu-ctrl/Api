"""Single source of truth for what counts as a *bad* order outcome.

A bad outcome is a training/reputation label: it says "this order was fake or
fraudulent". Cancellations that happened for operational reasons (stock) or
because Ordium itself recommended blocking the order must not be counted,
otherwise the engine learns from its own decisions (feedback loop) and a
merchant's stock problems leak into cross-merchant reputation.
"""

BAD_OUTCOME_STATUSES: frozenset[str] = frozenset({"cancelled", "returned"})

OUTCOME_REASONS: frozenset[str] = frozenset({
    "customer_refused",     # refused at delivery (COD)
    "unreachable",          # customer could not be reached
    "fake_order",           # merchant confirmed the order was fake
    "customer_cancelled",   # customer cancelled before shipping
    "out_of_stock",         # merchant could not fulfil
    "risk_decision",        # merchant cancelled because Ordium flagged it
    "other",
})

# Reasons that explain a cancellation/return without implying the buyer was bad.
NON_BAD_REASONS: frozenset[str] = frozenset({"out_of_stock", "risk_decision"})


def is_bad_outcome(outcome_status: str | None, reason: str | None = None) -> bool:
    if outcome_status not in BAD_OUTCOME_STATUSES:
        return False
    return reason not in NON_BAD_REASONS
