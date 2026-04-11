# backend/app/clustering/gi_star.py
#
# Computes the Getis-Ord Gi* local spatial statistic on H3 hex scores.
# Hexes with z > 1.96 and p < 0.05 are statistically significant hotspots.

import json
import numpy as np
import geopandas as gpd
import pandas as pd
from scipy import stats


def compute_gi_star(
    gdf: gpd.GeoDataFrame,
    score_col: str = "avg_score",
    neighbor_radius_m: float = 10_000.0,
) -> gpd.GeoDataFrame:
    """
    Compute Getis-Ord Gi* z-scores and p-values for each hex.

    The statistic measures whether a hex and its neighbours have
    significantly higher values than the global mean (hotspot) or
    significantly lower values (coldspot).

    Args:
        gdf:               GeoDataFrame (EPSG:32643) with score_col
        score_col:         column holding the aggregated score per hex
        neighbor_radius_m: spatial search radius for neighbours (metres)

    Returns:
        Input GeoDataFrame with three extra columns:
            gi_z      — Gi* z-score
            p_value   — two-tailed p-value
            is_hotspot — True if z > 1.96 and p < 0.05
    """
    if score_col not in gdf.columns:
        gdf = gdf.copy()
        gdf[score_col] = 50.0

    scores = gdf[score_col].values.astype(float)
    n      = len(scores)
    mu     = scores.mean()
    s      = scores.std()

    # Pre-compute centroids once for speed
    centroids_x = gdf.geometry.centroid.x.values
    centroids_y = gdf.geometry.centroid.y.values

    gi_z_values  = []
    p_values     = []

    for i in range(n):
        # Euclidean distance from hex i to all other hexes (metres, EPSG:32643)
        dx = centroids_x - centroids_x[i]
        dy = centroids_y - centroids_y[i]
        dist = np.sqrt(dx ** 2 + dy ** 2)

        # Binary spatial weight matrix (1 if within radius, else 0)
        w = (dist <= neighbor_radius_m).astype(float)

        wi_sum  = w.sum()           # number of neighbours (including self)
        wxi_sum = (w * scores).sum()

        if wi_sum == 0 or s == 0:
            gi_z_values.append(0.0)
            p_values.append(1.0)
            continue

        # Gi* formula
        numerator   = wxi_sum - mu * wi_sum
        denominator = s * np.sqrt(
            (n * (w ** 2).sum() - wi_sum ** 2) / (n - 1)
        )

        z = numerator / denominator if denominator != 0 else 0.0
        p = float(2 * (1 - stats.norm.cdf(abs(z))))

        gi_z_values.append(round(float(z), 4))
        p_values.append(round(p, 6))

    result = gdf.copy()
    result["gi_z"]      = gi_z_values
    result["p_value"]   = p_values
    result["is_hotspot"] = (result["gi_z"] > 1.96) & (result["p_value"] < 0.05)

    return result


def get_hotspots_geojson(engine, neighbor_radius_m: float = 10_000.0) -> dict:
    """
    Load H3 grid from PostGIS, compute Gi*, return only hotspot cells as GeoJSON.
    Limits to 5 000 hexes for performance (representative sample).
    """
    for table in ("h3_grid_res7", "h3_grid_res8"):
        try:
            gdf = gpd.read_postgis(
                f"SELECT h3_id, geometry, avg_score FROM {table} WHERE avg_score IS NOT NULL LIMIT 5000",
                engine,
                geom_col="geometry",
            )
            if len(gdf) > 0:
                break
        except Exception:
            continue
    else:
        return {"type": "FeatureCollection", "features": []}

    result   = compute_gi_star(gdf, neighbor_radius_m=neighbor_radius_m)
    hotspots = result[result["is_hotspot"]].to_crs("EPSG:4326")

    if hotspots.empty:
        return {"type": "FeatureCollection", "features": []}

    return json.loads(hotspots.to_json())
