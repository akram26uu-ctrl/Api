from dataclasses import dataclass


@dataclass(frozen=True)
class IdentityConfidence:
    score: int
    reasons: tuple[str, ...]


def calculate_identity_confidence(
    *,
    exact_phone: bool,
    exact_name: bool,
    existing_customer: bool,
) -> IdentityConfidence:
    # A newly created customer has no historical identity evidence.
    # Never award "exact_name" confidence merely because the just-created
    # record contains the submitted name.
    if not existing_customer:
        if exact_phone:
            return IdentityConfidence(55, ("phone_seen_before",))
        return IdentityConfidence(0, ())

    if exact_phone and exact_name:
        return IdentityConfidence(100, ("existing_customer", "exact_phone", "exact_name"))
    if exact_phone:
        return IdentityConfidence(90, ("existing_customer", "exact_phone"))
    if exact_name:
        return IdentityConfidence(75, ("existing_customer", "exact_name"))
    return IdentityConfidence(65, ("existing_customer",))
