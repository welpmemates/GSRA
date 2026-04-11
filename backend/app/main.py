# backend/app/main.py
#
# Phase 5 — Full Backend API
# Endpoints:
#   GET  /                    health / info
#   GET  /api/health          DB connectivity check
#   POST /api/score           site readiness score
#   GET  /api/layers/{name}   raw PostGIS layer as GeoJSON
#   GET  /api/clusters        DBSCAN cluster polygons
#   GET  /api/hotspots        Getis-Ord Gi* hotspot hexes
#   POST /api/isochrone       OSRM drive/walk isochrones
#   POST /api/compare         compare multiple sites
#   POST /api/export          export results as CSV

import io
import json
import os

import geopandas as gpd
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from typing import Literal, Optional

from app.clustering.dbscan_clusters import get_clusters_geojson
from app.clustering.gi_star import get_hotspots_geojson
from app.db.spatial_queries import engine, fetch_site_metrics
from app.routing.isochrone import compute_isochrone
from app.scoring.engine import compute_final_score
from app.scoring.weights import USE_CASE_PRESETS, get_weights


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GSRA — GeoSpatial Site Readiness Analyzer",
    description=(
        "AI-powered geospatial decision engine for Gujarat. "
        "Computes site readiness scores (0–100) using multi-layer spatial analysis."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Supported PostGIS layer names ─────────────────────────────────────────────

ALLOWED_LAYERS: dict[str, str] = {
    "roads":        "roads",
    "buildings":    "buildings",
    "land_use":     "land_use",
    "competitors":  "competitors",
    "districts":    "districts",
    "flood_zones":  "flood_zones",
    "h3_grid_res7": "h3_grid_res7",
    "h3_grid_res8": "h3_grid_res8",
}

# How many features to return per layer (keeps responses fast)
LAYER_LIMITS: dict[str, int] = {
    "roads":        5_000,
    "buildings":    3_000,
    "land_use":     2_000,
    "competitors":  5_000,
    "districts":    200,
    "flood_zones":  2_000,
    "h3_grid_res7": 10_000,
    "h3_grid_res8": 10_000,
}


# ── Pydantic models ───────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    lat: float = Field(..., ge=20.1, le=24.7, description="Latitude (Gujarat range)")
    lon: float = Field(..., ge=68.2, le=74.5, description="Longitude (Gujarat range)")
    use_case: Literal["retail", "warehouse", "ev_charging", "telecom"] = Field(
        "retail",
        description="Business use-case — selects AHP weight preset",
    )

    @field_validator("lat")
    @classmethod
    def lat_in_gujarat(cls, v: float) -> float:
        if not (20.1 <= v <= 24.7):
            raise ValueError("lat must be within Gujarat bounds (20.1 – 24.7)")
        return v

    @field_validator("lon")
    @classmethod
    def lon_in_gujarat(cls, v: float) -> float:
        if not (68.2 <= v <= 74.5):
            raise ValueError("lon must be within Gujarat bounds (68.2 – 74.5)")
        return v


class ScoreResponse(BaseModel):
    final_score:     float
    breakdown:       dict
    constraints:     dict
    weights_applied: dict
    raw_metrics:     dict


class IsochroneRequest(BaseModel):
    lat:     float = Field(..., ge=20.1, le=24.7)
    lon:     float = Field(..., ge=68.2, le=74.5)
    mode:    Literal["car", "foot"] = "car"
    minutes: list[int] = Field(default=[10, 20, 30])

    @field_validator("minutes")
    @classmethod
    def valid_minutes(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("minutes list must not be empty")
        if any(m <= 0 or m > 60 for m in v):
            raise ValueError("Each value in minutes must be between 1 and 60")
        return sorted(set(v))


class CompareRequest(BaseModel):
    locations: list[ScoreRequest] = Field(..., min_length=1, max_length=10)


class ExportRequest(BaseModel):
    locations: list[ScoreRequest] = Field(..., min_length=1, max_length=50)


# ── Root & health ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
def root():
    return {
        "message":    "GSRA backend running",
        "version":    "2.0.0",
        "use_cases":  list(USE_CASE_PRESETS.keys()),
        "endpoints": [
            "POST /api/score",
            "GET  /api/layers/{name}",
            "GET  /api/clusters",
            "GET  /api/hotspots",
            "POST /api/isochrone",
            "POST /api/compare",
            "POST /api/export",
        ],
    }


@app.get("/api/health", tags=["Info"])
def health():
    """Quick DB connectivity check."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB unreachable: {str(e)}")


# ── Score ─────────────────────────────────────────────────────────────────────

@app.post("/api/score", response_model=ScoreResponse, tags=["Scoring"])
def score_site(request: ScoreRequest):
    """
    Compute site readiness score (0–100) for a lat/lon coordinate.

    Returns score breakdown, constraint status, and raw metrics.
    """
    try:
        weights = get_weights(request.use_case)
        metrics = fetch_site_metrics(lat=request.lat, lon=request.lon)
        return compute_final_score(metrics=metrics, weights=weights)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


# ── Layers ────────────────────────────────────────────────────────────────────

@app.get("/api/layers/{name}", tags=["Layers"])
def get_layer(
    name: str,
    limit: Optional[int] = Query(None, description="Override default feature limit"),
):
    """
    Return a PostGIS table as a GeoJSON FeatureCollection.

    Supported names: roads, buildings, land_use, competitors,
    districts, flood_zones, h3_grid_res7, h3_grid_res8
    """
    if name not in ALLOWED_LAYERS:
        raise HTTPException(
            status_code=404,
            detail=f"Layer '{name}' not found. Available: {list(ALLOWED_LAYERS.keys())}",
        )

    table     = ALLOWED_LAYERS[name]
    row_limit = limit if limit is not None else LAYER_LIMITS.get(name, 2_000)
    row_limit = min(row_limit, 50_000)  # hard cap

    try:
        gdf = gpd.read_postgis(
            f"SELECT * FROM {table} LIMIT {row_limit}",
            engine,
            geom_col="geometry",
        )
        gdf = gdf.to_crs("EPSG:4326")
        return json.loads(gdf.to_json())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Layer query failed: {str(e)}")


# ── Clusters ─────────────────────────────────────────────────────────────────

@app.get("/api/clusters", tags=["Spatial Analysis"])
def get_clusters(
    min_score: float = Query(40.0, description="Minimum avg_score to include a hex"),
    eps_km:    float = Query(5.0,  description="DBSCAN neighbourhood radius (km)"),
):
    """
    Run DBSCAN on the H3 hex grid and return cluster convex hulls as GeoJSON.

    Each feature contains:
        cluster_id, hex_count, avg_score
    """
    try:
        # Pass eps in metres
        from app.clustering.dbscan_clusters import run_dbscan

        for table in ("h3_grid_res8", "h3_grid_res7"):
            try:
                gdf = gpd.read_postgis(
                    f"SELECT h3_id, geometry, avg_score FROM {table} LIMIT 100000",
                    engine,
                    geom_col="geometry",
                )
                if len(gdf) > 0:
                    break
            except Exception:
                continue
        else:
            return {"type": "FeatureCollection", "features": []}

        clusters = run_dbscan(gdf, min_score=min_score, eps_m=eps_km * 1000)

        if clusters.empty:
            return {"type": "FeatureCollection", "features": []}

        return json.loads(clusters.to_json())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


# ── Hotspots ─────────────────────────────────────────────────────────────────

@app.get("/api/hotspots", tags=["Spatial Analysis"])
def get_hotspots(
    radius_km: float = Query(10.0, description="Gi* neighbour search radius (km)"),
):
    """
    Compute Getis-Ord Gi* statistics and return statistically significant
    hotspot hexes (z > 1.96, p < 0.05) as GeoJSON.

    Each feature includes gi_z, p_value, is_hotspot columns.
    """
    try:
        result = get_hotspots_geojson(engine, neighbor_radius_m=radius_km * 1000)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hotspot analysis failed: {str(e)}")


# ── Isochrone ─────────────────────────────────────────────────────────────────

@app.post("/api/isochrone", tags=["Routing"])
async def get_isochrone(request: IsochroneRequest):
    """
    Generate drive-time or walk-time isochrone polygons using local OSRM.

    Returns GeoJSON polygons for each requested time threshold.
    If OSRM is not running, geometry will be null but no error is raised.

    Example body:
        {"lat": 23.0225, "lon": 72.5714, "mode": "car", "minutes": [10, 20, 30]}
    """
    try:
        isochrones = await compute_isochrone(
            lat=request.lat,
            lon=request.lon,
            mode=request.mode,
            minutes=request.minutes,
        )
        return {"isochrones": isochrones}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Isochrone failed: {str(e)}")


# ── Compare ───────────────────────────────────────────────────────────────────

@app.post("/api/compare", tags=["Scoring"])
def compare_sites(request: CompareRequest):
    """
    Score multiple sites and return them side-by-side for comparison.

    Input: list of {lat, lon, use_case} objects (max 10).
    Output: ranked list of scored results with a rank field.
    """
    results = []

    for loc in request.locations:
        try:
            weights = get_weights(loc.use_case)
            metrics = fetch_site_metrics(lat=loc.lat, lon=loc.lon)
            scored  = compute_final_score(metrics=metrics, weights=weights)
            results.append({
                "lat":      loc.lat,
                "lon":      loc.lon,
                "use_case": loc.use_case,
                **scored,
            })
        except Exception as e:
            results.append({
                "lat":      loc.lat,
                "lon":      loc.lon,
                "use_case": loc.use_case,
                "error":    str(e),
                "final_score": None,
            })

    # Sort by final_score descending (None scores go last)
    results.sort(
        key=lambda r: r.get("final_score") or -1,
        reverse=True,
    )

    for i, r in enumerate(results):
        r["rank"] = i + 1

    return {"results": results, "count": len(results)}


# ── Export ────────────────────────────────────────────────────────────────────

@app.post("/api/export", tags=["Export"])
def export_results(request: ExportRequest):
    """
    Score all submitted locations and return results as a downloadable CSV.

    Columns: rank, lat, lon, use_case, final_score, and all breakdown sub-scores.
    """
    rows = []

    for loc in request.locations:
        try:
            weights = get_weights(loc.use_case)
            metrics = fetch_site_metrics(lat=loc.lat, lon=loc.lon)
            scored  = compute_final_score(metrics=metrics, weights=weights)

            row = {
                "lat":      loc.lat,
                "lon":      loc.lon,
                "use_case": loc.use_case,
                "final_score": scored["final_score"],
            }
            # Flatten breakdown sub-scores
            for k, v in scored.get("breakdown", {}).items():
                row[f"breakdown_{k}"] = v
            # Flatten constraints
            for k, v in scored.get("constraints", {}).items():
                if isinstance(v, dict):
                    row[f"constraint_{k}_passed"] = v.get("passed", "")
                else:
                    row[f"constraint_{k}"] = v
            # Raw metrics
            for k, v in scored.get("raw_metrics", {}).items():
                row[f"metric_{k}"] = v

            rows.append(row)

        except Exception as e:
            rows.append({
                "lat":      loc.lat,
                "lon":      loc.lon,
                "use_case": loc.use_case,
                "final_score": None,
                "error":    str(e),
            })

    # Sort by final_score descending
    rows.sort(key=lambda r: r.get("final_score") or -1, reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    df = pd.DataFrame(rows)

    # Move rank to first column
    cols = ["rank"] + [c for c in df.columns if c != "rank"]
    df   = df[cols]

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gsra_export.csv"},
    )
