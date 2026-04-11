# backend/app/clustering/dbscan_clusters.py
#
# Runs DBSCAN on high-scoring H3 hexes loaded from PostGIS.
# Returns a GeoJSON FeatureCollection of cluster polygons (convex hulls).

import json
import numpy as np
import geopandas as gpd
from sklearn.cluster import DBSCAN
from shapely.ops import unary_union


def run_dbscan(
    gdf: gpd.GeoDataFrame,
    score_col: str = "avg_score",
    min_score: float = 40.0,
    eps_m: float = 5000.0,
    min_samples: int = 3,
) -> gpd.GeoDataFrame:
    """
    Run DBSCAN on H3 hex centroids whose avg_score >= min_score.

    Args:
        gdf:        GeoDataFrame from PostGIS (EPSG:32643, has score_col)
        score_col:  column that holds the aggregated score per hex
        min_score:  only cluster hexes above this threshold
        eps_m:      DBSCAN neighbourhood radius in metres (CRS is metric)
        min_samples:minimum hexes to form a cluster core

    Returns:
        GeoDataFrame (EPSG:4326) with columns:
            cluster_id, hex_count, avg_score, geometry (convex hull polygon)
        Empty GeoDataFrame if no clusters found.
    """
    if score_col not in gdf.columns:
        raise ValueError("avg_score column missing — run scoring pipeline first")

    high = gdf[gdf[score_col] >= min_score].copy()

    if len(high) < min_samples:
        return gpd.GeoDataFrame(columns=["cluster_id", "hex_count", "avg_score", "geometry"])

    # Centroid coordinates — already in metres (EPSG:32643)
    coords = np.array([
        [geom.centroid.x, geom.centroid.y]
        for geom in high.geometry
    ])

    labels = DBSCAN(
        eps=eps_m,
        min_samples=min_samples,
        algorithm="ball_tree",
        metric="euclidean",
    ).fit_predict(coords)

    high = high.copy()
    high["cluster_id"] = labels

    # -1 = noise; drop noise points
    clustered = high[high["cluster_id"] >= 0]

    if clustered.empty:
        return gpd.GeoDataFrame(columns=["cluster_id", "hex_count", "avg_score", "geometry"])

    # Build one convex-hull polygon per cluster
    rows = []
    for cid, group in clustered.groupby("cluster_id"):
        hull = unary_union(group.geometry).convex_hull
        rows.append({
            "cluster_id": int(cid),
            "hex_count":  len(group),
            "avg_score":  round(float(group[score_col].mean()), 2),
            "geometry":   hull,
        })

    result = gpd.GeoDataFrame(rows, crs="EPSG:32643")
    return result.to_crs("EPSG:4326")


def get_clusters_geojson(engine, min_score: float = 40.0) -> dict:
    """
    Load H3 grid from PostGIS, run DBSCAN, return GeoJSON dict.
    Tries res8 first, falls back to res7.
    """
    for table in ("h3_grid_res8", "h3_grid_res7"):
        try:
            gdf = gpd.read_postgis(
                f"SELECT geometry FROM {table} LIMIT 100000",
                engine,
                geom_col="geometry",
            )
            if len(gdf) > 0:
                break
        except Exception:
            continue
    else:
        return {"type": "FeatureCollection", "features": []}

    clusters = run_dbscan(gdf, min_score=min_score)

    if clusters.empty:
        return {"type": "FeatureCollection", "features": []}

    return json.loads(clusters.to_json())
