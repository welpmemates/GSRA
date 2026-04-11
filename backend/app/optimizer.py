# backend/app/optimizer.py

import random
from typing import Dict, Tuple
from sqlalchemy.engine import Engine

from app.scoring.weights import ScoringWeights, USE_CASE_PRESETS
from app.scoring.engine import compute_final_score
from app.db.spatial_queries import fetch_site_metrics


# ---------------------------------------------------------
# RL INTERPRETATION (LIGHTWEIGHT)
# ---------------------------------------------------------
# State  = location + spatial metrics
# Action = weight vector selection
# Reward = final site score
#
# We simulate PPO-style optimization via:
# -> random sampling + selection (no heavy training)
# ---------------------------------------------------------


def _generate_random_weights() -> ScoringWeights:
    """
    Generate random weights that sum to 1
    """
    vals = [random.random() for _ in range(5)]
    vals = [max(0.05, v) for v in vals]
    
    total = sum(vals)

    return ScoringWeights(
        demographic=vals[0] / total,
        transportation=vals[1] / total,
        poi_competitor=vals[2] / total,
        land_use=vals[3] / total,
        environmental=vals[4] / total,
    )


def _mutate_weights(weights: ScoringWeights, strength: float = 0.1) -> ScoringWeights:
    """
    Small mutation (evolutionary idea)
    """
    vals = [
        weights.demographic + random.uniform(-strength, strength),
        weights.transportation + random.uniform(-strength, strength),
        weights.poi_competitor + random.uniform(-strength, strength),
        weights.land_use + random.uniform(-strength, strength),
        weights.environmental + random.uniform(-strength, strength),
    ]

    # ensure non-negative
    vals = [max(0.005, v) for v in vals]
    total = sum(vals)

    return ScoringWeights(
        demographic=vals[0] / total,
        transportation=vals[1] / total,
        poi_competitor=vals[2] / total,
        land_use=vals[3] / total,
        environmental=vals[4] / total,
    )


def optimize_weights(
    engine: Engine,
    lat: float,
    lon: float,
    use_case: str,
    n_samples: int = 60
) -> Tuple[Dict, float]:
    """
    Main optimizer function

    Returns:
        (best_weights_dict, best_score)
    """

    # -------------------------------
    # STEP 1: Fetch metrics ONCE
    # -------------------------------
    metrics = fetch_site_metrics(lat=lat, lon=lon)

    # -------------------------------
    # STEP 2: Initialize base weights
    # -------------------------------
    base_weights = USE_CASE_PRESETS.get(
        use_case,
        USE_CASE_PRESETS["retail"]  # safe default
    )

    best_weights = base_weights
    best_result = compute_final_score(metrics=metrics, weights=best_weights)
    best_score = best_result["final_score"]

    # -------------------------------
    # STEP 3: Random search
    # -------------------------------
    for _ in range(n_samples):
        candidate = _generate_random_weights()

        result = compute_final_score(metrics=metrics, weights=candidate)
        score = result["final_score"]

        if score > best_score:
            best_score = score
            best_weights = candidate

    # -------------------------------
    # STEP 4: Local mutation (refinement)
    # -------------------------------
    for _ in range(20):
        candidate = _mutate_weights(best_weights)

        result = compute_final_score(metrics=metrics, weights=candidate)
        score = result["final_score"]

        if score > best_score:
            best_score = score
            best_weights = candidate

    return best_weights.__dict__, best_score
