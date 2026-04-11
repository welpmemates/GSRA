# backend/app/scoring/weights.py

from dataclasses import dataclass
from typing import ClassVar


@dataclass
class ScoringWeights:
    """
    AHP-derived weights for each scoring dimension.
    All weights MUST sum to 1.0.
    """
    demographic:     float  # population density, residential coverage
    transportation:  float  # road density, accessibility
    poi_competitor:  float  # competitor proximity / market saturation
    land_use:        float  # commercial land use fraction
    environmental:   float  # flood risk, air quality

    # ── Validation ────────────────────────────────────────────────────────────
    TOLERANCE: ClassVar[float] = 1e-6

    def validate(self) -> None:
        values = [
            self.demographic,
            self.transportation,
            self.poi_competitor,
            self.land_use,
            self.environmental,
        ]
        if any(v < 0 or v > 1 for v in values):
            raise ValueError("All weights must be between 0 and 1.")
        total = sum(values)
        if abs(total - 1.0) > self.TOLERANCE:
            raise ValueError(
                f"Weights must sum to 1.0, but sum is {total:.6f}. "
                f"Difference: {total - 1.0:+.6f}"
            )

    def as_dict(self) -> dict:
        return {
            "demographic":    self.demographic,
            "transportation": self.transportation,
            "poi_competitor": self.poi_competitor,
            "land_use":       self.land_use,
            "environmental":  self.environmental,
        }


# ── Use-Case Presets ──────────────────────────────────────────────────────────
#
# Rationale per use case:
#   retail      → foot traffic (pop) + moderate market competition
#   warehouse   → access roads dominate; population irrelevant
#   ev_charging → roads + environment (flood safety critical for infra)
#   telecom     → balanced; land use matters for tower placement
#
USE_CASE_PRESETS: dict[str, ScoringWeights] = {
    "retail": ScoringWeights(
        demographic    = 0.35,
        transportation = 0.25,
        poi_competitor = 0.20,
        land_use       = 0.15,
        environmental  = 0.05,
    ),
    "warehouse": ScoringWeights(
        demographic    = 0.10,
        transportation = 0.45,
        poi_competitor = 0.10,
        land_use       = 0.25,
        environmental  = 0.10,
    ),
    "ev_charging": ScoringWeights(
        demographic    = 0.15,
        transportation = 0.40,
        poi_competitor = 0.10,
        land_use       = 0.15,
        environmental  = 0.20,
    ),
    "telecom": ScoringWeights(
        demographic    = 0.25,
        transportation = 0.25,
        poi_competitor = 0.15,
        land_use       = 0.20,
        environmental  = 0.15,
    ),
    "grocery_store": ScoringWeights(
        demographic    = 0.40,
        transportation = 0.30,
        poi_competitor = 0.10,
        land_use       = 0.10,
        environmental  = 0.10,
    ),
    "clothing_store": ScoringWeights(
        demographic    = 0.30,
        transportation = 0.25,
        poi_competitor = 0.25,
        land_use       = 0.10,
        environmental  = 0.10,
    ),
    "electronic_store": ScoringWeights(
        demographic    = 0.25,
        transportation = 0.35,
        poi_competitor = 0.20,
        land_use       = 0.10,
        environmental  = 0.10,
    ),
    "pharmacy": ScoringWeights(
        demographic    = 0.35,
        transportation = 0.25,
        poi_competitor = 0.10,
        land_use       = 0.10,
        environmental  = 0.20,
    ),
    "luxury_retail": ScoringWeights(
        demographic    = 0.20,
        transportation = 0.30,
        poi_competitor = 0.15,
        land_use       = 0.20,
        environmental  = 0.15,
    ),
}

# Validate all presets at import time — fail loudly if someone edits badly
for _name, _preset in USE_CASE_PRESETS.items():
    try:
        _preset.validate()
    except ValueError as e:
        raise ValueError(f"Invalid preset '{_name}': {e}") from e


def get_weights(use_case: str) -> ScoringWeights:
    """
    Return validated ScoringWeights for a given use case.
    Raises KeyError for unknown use cases.
    """
    if use_case not in USE_CASE_PRESETS:
        valid = ", ".join(USE_CASE_PRESETS.keys())
        raise KeyError(f"Unknown use_case '{use_case}'. Valid options: {valid}")
    return USE_CASE_PRESETS[use_case]
