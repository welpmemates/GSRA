# backend/app/scoring/engine.py

import math
from .weights import ScoringWeights


# ─────────────────────────────────────────────────────────────────────────────
#  NORMALIZATION RANGES
#  Tuned to Gujarat / building-count proxy scale.
#  pop_5km is building count (proxy), not census population.
# ─────────────────────────────────────────────────────────────────────────────
NORM_RANGES = {
    "pop_5km":             (0,    50_000),  # building count proxy
    "road_count_1km":      (0,    800),     # road segments in 1 km radius
    "commercial_land_pct": (0.0,  1.0),     # fraction already in [0,1]
    "flood_risk":          (0.0,  1.0),     # already in [0,1]
}

# Competitor Gaussian parameters (tuned for Gujarat urban density)
COMPETITOR_IDEAL   = 15    # ideal number of competitors nearby
COMPETITOR_SIGMA   = 10    # spread — how quickly score falls off from ideal

# Constraint threshold
MIN_POP_PROXY = 50         # minimum building count within 5 km


# ─────────────────────────────────────────────────────────────────────────────
#  MATH PRIMITIVES
# ─────────────────────────────────────────────────────────────────────────────

def normalize(value: float, min_val: float, max_val: float) -> float:
    """
    Linear normalization → [0, 1].
    Values outside [min_val, max_val] are clamped.
    """
    if max_val <= min_val:
        return 0.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def exponential_decay(value: float, distance: float, rate: float) -> float:
    """
    Apply exponential distance decay: value * e^(-rate * distance).
    Used to model influence of roads/POIs that diminishes with distance.

    Args:
        value:    base score or count (already normalized [0,1] recommended)
        distance: distance in metres
        rate:     decay rate (higher = faster falloff)
    """
    return value * math.exp(-rate * distance)


def competitor_score(count: int) -> float:
    """
    Gaussian scoring for competitor density.
    - Too few  → poor market signal, low score
    - Ideal    → best score (1.0)
    - Too many → market saturation, lower score

    Uses: exp(-0.5 * ((count - ideal) / sigma)^2)
    """
    return math.exp(-0.5 * ((count - COMPETITOR_IDEAL) / COMPETITOR_SIGMA) ** 2)


# ─────────────────────────────────────────────────────────────────────────────
#  CONSTRAINTS
# ─────────────────────────────────────────────────────────────────────────────

def apply_constraints(metrics: dict) -> dict:
    report = {}

    # Population constraint (soft)
    pop_ok = metrics["pop_5km"] >= MIN_POP_PROXY
    report["min_population_met"] = {
        "passed": pop_ok,
        "value": metrics["pop_5km"],
        "threshold": MIN_POP_PROXY,
        "penalty": 0.5 if not pop_ok else 1.0
    }

    # Restricted zone (soft)
    not_restricted = not metrics["in_restricted_zone"]
    report["not_in_restricted_zone"] = {
        "passed": not_restricted,
        "value": metrics["in_restricted_zone"],
        "penalty": 0.5 if not not_restricted else 1.0
    }

    return report


# ─────────────────────────────────────────────────────────────────────────────
#  SUB-SCORE COMPUTATION
# ─────────────────────────────────────────────────────────────────────────────

def compute_sub_scores(metrics: dict) -> dict:
    """
    Convert raw PostGIS metrics → normalized sub-scores in [0, 1].

    Sub-scores:
        demographic_score   — based on building density proxy
        transport_score     — based on road segment count
        competitor_score    — Gaussian around ideal competitor count
        land_use_score      — commercial land fraction
        environmental_score — inverse of flood risk
    """
    # Demographic: normalize building proxy count
    demographic = normalize(
        metrics["pop_5km"],
        *NORM_RANGES["pop_5km"]
    )

    # Transport: normalize road count, then apply mild distance decay
    # (decay models that roads at the edge of 1 km matter less than nearby)
    transport_raw = normalize(
        metrics["road_count_1km"],
        *NORM_RANGES["road_count_1km"]
    )
    # Average query radius for roads is ~500 m; apply gentle decay
    transport = exponential_decay(transport_raw, distance=500, rate=0.0003)

    # Competitor: Gaussian
    comp = competitor_score(metrics["competitor_count_2km"])

    # Land use: direct fraction [0,1]
    land_use = normalize(
        metrics["commercial_land_pct"],
        *NORM_RANGES["commercial_land_pct"]
    )

    # Environmental: invert flood risk (high risk → low score)
    environmental = 1.0 - normalize(
        metrics["flood_risk"],
        *NORM_RANGES["flood_risk"]
    )

    return {
        "demographic_score":   round(demographic,    4),
        "transport_score":     round(transport,       4),
        "competitor_score":    round(comp,            4),
        "land_use_score":      round(land_use,        4),
        "environmental_score": round(environmental,   4),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  FINAL SCORE
# ─────────────────────────────────────────────────────────────────────────────

def compute_final_score(
    metrics: dict,
    weights: ScoringWeights,
) -> dict:
    """
    Orchestrate the full scoring pipeline.

    Args:
        metrics: raw dict from fetch_site_metrics()
        weights: ScoringWeights instance (validated)

    Returns:
        {
            "final_score":     float,   # 0–100
            "breakdown":       dict,    # sub-scores
            "constraints":     dict,    # constraint report
            "weights_applied": dict,    # weights used
            "raw_metrics":     dict,    # pass-through for transparency
        }
    """
    weights.validate()

    # 1. Sub-scores
    sub = compute_sub_scores(metrics)

    # 2. Constraints
    constraint_report = apply_constraints(metrics)

    # 3. Weighted sum
    weighted = (
        weights.demographic    * sub["demographic_score"]
        + weights.transportation * sub["transport_score"]
        + weights.poi_competitor * sub["competitor_score"]
        + weights.land_use       * sub["land_use_score"]
        + weights.environmental  * sub["environmental_score"]
    )

    # 4. Apply constraint and scale to 0–100
    penalty = 1.0
    for c in constraint_report.values():
        penalty *= c.get("penalty", 1.0)

    final_score = round(weighted * penalty * 300, 2)

    return {
        "final_score":     final_score,
        "breakdown":       sub,
        "constraints":     constraint_report,
        "weights_applied": weights.as_dict(),
        "raw_metrics":     {
            k: round(v, 4) if isinstance(v, float) else v
            for k, v in metrics.items()
        },
    }
