# backend/app/main.py

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
from shapely.geometry import Point

from app.clustering.dbscan_clusters import run_dbscan
from app.clustering.gi_star import compute_gi_star, get_hotspots_geojson
from app.db.spatial_queries import engine, fetch_site_metrics
from app.routing.isochrone import compute_isochrone
from app.scoring.engine import compute_final_score
from app.scoring.weights import USE_CASE_PRESETS, get_weights, ScoringWeights


# ── Ahmedabad Bounding Box ────────────────────────────────────
# WGS84:  lon 72.45–72.75, lat 22.95–23.15
# This is applied to ALL layer queries so the system behaves as Ahmedabad-only
# WITHOUT re-running the ETL pipeline.

AHMEDABAD_BBOX_SQL = """
    ST_Transform(
        ST_MakeEnvelope(72.45, 22.95, 72.75, 23.15, 4326),
        32643
    )
"""

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="GSRA — GeoSpatial Site Readiness Analyzer",
    description="AI-powered geospatial decision engine for Ahmedabad, India.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Layer config ──────────────────────────────────────────────
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

LAYER_LIMITS: dict[str, int] = {
    "roads":        3_000,
    "buildings":    2_000,
    "land_use":     1_500,
    "competitors":  3_000,
    "districts":    50,
    "flood_zones":  1_000,
    "h3_grid_res7": 5_000,
    "h3_grid_res8": 5_000,
}


# ── Pydantic models ───────────────────────────────────────────

class ScoreRequest(BaseModel):
    lat:      float = Field(..., ge=22.95, le=23.15, description="Latitude (Ahmedabad)")
    lon:      float = Field(..., ge=72.45, le=72.75, description="Longitude (Ahmedabad)")
    use_case: Literal["retail", "warehouse", "ev_charging", "telecom"] = "retail"
    # Phase 7: accept custom weights from frontend sliders
    weights:  Optional[dict] = Field(None, description=(
        "Custom weight dict: {demographic, transportation, poi_competitor, land_use, environmental}"
    ))


class ScoreResponse(BaseModel):
    final_score:     float
    breakdown:       dict
    constraints:     dict
    weights_applied: dict
    raw_metrics:     dict


class IsochroneRequest(BaseModel):
    lat:     float = Field(..., ge=22.95, le=23.15)
    lon:     float = Field(..., ge=72.45, le=72.75)
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


# ── Root & health ─────────────────────────────────────────────

@app.get("/", tags=["Info"])
def root():
    return {
        "message":  "GSRA backend (Ahmedabad scope)",
        "version":  "3.0.0",
        "city":     "Ahmedabad, Gujarat, India",
        "bbox":     "72.45°E–72.75°E, 22.95°N–23.15°N",
        "use_cases": list(USE_CASE_PRESETS.keys()),
    }


@app.get("/api/health", tags=["Info"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected", "scope": "Ahmedabad"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB unreachable: {str(e)}")


# ── Score ─────────────────────────────────────────────────────

@app.post("/api/score", response_model=ScoreResponse, tags=["Scoring"])
def score_site(request: ScoreRequest):
    """
    - Supports custom weights from frontend
    - Returns raw_metrics for UI
    - Uses correct scoring function
    """
    try:
        # Handle custom weights
        if request.weights:
            w = request.weights
            weights = ScoringWeights(
                demographic    = w.get("demographic", 0.25),
                transportation = w.get("transportation", 0.25),
                poi_competitor = w.get("poi_competitor", 0.20),
                land_use       = w.get("land_use", 0.15),
                environmental  = w.get("environmental", 0.15),
            )
        else:
            weights = get_weights(request.use_case)

        # Fetch metrics
        metrics = fetch_site_metrics(lat=request.lat, lon=request.lon)

        # Compute score (CORRECT function)
        result = compute_final_score(metrics=metrics, weights=weights)

        # CRITICAL: attach raw metrics for frontend
        result["raw_metrics"] = metrics

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


# ── Layers (filtered to Ahmedabad) ────────────────────────────

@app.get("/api/layers/{name}", tags=["Layers"])
def get_layer(
    name: str,
    limit: Optional[int] = Query(None),
):
    if name not in ALLOWED_LAYERS:
        raise HTTPException(
            status_code=404,
            detail=f"Layer '{name}' not found. Available: {list(ALLOWED_LAYERS.keys())}",
        )

    table     = ALLOWED_LAYERS[name]
    row_limit = min(limit or LAYER_LIMITS.get(name, 2_000), 50_000)

    try:
        # Phase 7: filter to Ahmedabad bbox
        query = f"""
            SELECT * FROM {table}
            WHERE ST_Intersects(geometry, {AHMEDABAD_BBOX_SQL})
            LIMIT {row_limit}
        """
        gdf = gpd.read_postgis(query, engine, geom_col="geometry")
        gdf = gdf.to_crs("EPSG:4326")
        return json.loads(gdf.to_json())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Layer query failed: {str(e)}")


# ── Clusters (Ahmedabad) ──────────────────────────────────────

@app.get("/api/clusters", tags=["Spatial Analysis"])
def get_clusters(
    min_score: float = Query(40.0),
    eps_km:    float = Query(5.0),
):
    try:
        for table in ("h3_grid_res8", "h3_grid_res7"):
            try:
                query = f"""
                    SELECT h3_id, geometry, avg_score FROM {table}
                    WHERE ST_Intersects(geometry, {AHMEDABAD_BBOX_SQL})
                    AND avg_score IS NOT NULL
                    LIMIT 10000
                """
                gdf = gpd.read_postgis(query, engine, geom_col="geometry")
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


# ── Hotspots (Ahmedabad) ──────────────────────────────────────

@app.get("/api/hotspots", tags=["Spatial Analysis"])
def get_hotspots(radius_km: float = Query(10.0)):
    try:
        for table in ("h3_grid_res7", "h3_grid_res8"):
            try:
                query = f"""
                    SELECT h3_id, geometry, avg_score FROM {table}
                    WHERE ST_Intersects(geometry, {AHMEDABAD_BBOX_SQL})
                    AND avg_score IS NOT NULL
                    LIMIT 3000
                """
                gdf = gpd.read_postgis(query, engine, geom_col="geometry")
                if len(gdf) > 0:
                    break
            except Exception:
                continue
        else:
            return {"type": "FeatureCollection", "features": []}

        result   = compute_gi_star(gdf, neighbor_radius_m=radius_km * 1000)
        hotspots = result[result["is_hotspot"]].to_crs("EPSG:4326")

        if hotspots.empty:
            return {"type": "FeatureCollection", "features": []}

        return json.loads(hotspots.to_json())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hotspot analysis failed: {str(e)}")


# ── Isochrone ─────────────────────────────────────────────────

@app.post("/api/isochrone", tags=["Routing"])
async def get_isochrone(request: IsochroneRequest):
    try:
        isochrones = await compute_isochrone(
            lat=request.lat,
            lon=request.lon,
            mode=request.mode,
            minutes=request.minutes,
        )

        # ✅ Fallback if OSRM fails
        if not isochrones or all(not iso.get("geometry") for iso in isochrones):
            fallback = []
            for mins in request.minutes:
                buffer = Point(request.lon, request.lat).buffer(0.01 * (mins / 10))
                fallback.append({
                    "minutes": mins,
                    "geometry": gpd.GeoSeries([buffer]).__geo_interface__["features"][0]["geometry"]
                })
            return {"isochrones": fallback}

        return {"isochrones": isochrones}

    except Exception:
        # Full fallback
        fallback = []
        for mins in request.minutes:
            buffer = Point(request.lon, request.lat).buffer(0.01 * (mins / 10))
            fallback.append({
                "minutes": mins,
                "geometry": gpd.GeoSeries([buffer]).__geo_interface__["features"][0]["geometry"]
            })
        return {"isochrones": fallback}


# ── Compare ───────────────────────────────────────────────────

@app.post("/api/compare", tags=["Scoring"])
def compare_sites(request: CompareRequest):
    results = []
    for loc in request.locations:
        try:
            if loc.weights:
                w = loc.weights
                weights = ScoringWeights(
                    demographic=w.get("demographic", 0.25),
                    transportation=w.get("transportation", 0.25),
                    poi_competitor=w.get("poi_competitor", 0.20),
                    land_use=w.get("land_use", 0.15),
                    environmental=w.get("environmental", 0.15),
                )
            else:
                weights = get_weights(loc.use_case)

            metrics = fetch_site_metrics(lat=loc.lat, lon=loc.lon)
            scored  = compute_final_score(metrics=metrics, weights=weights)
            results.append({"lat": loc.lat, "lon": loc.lon, "use_case": loc.use_case, **scored})
        except Exception as e:
            results.append({"lat": loc.lat, "lon": loc.lon, "error": str(e), "final_score": None})

    results.sort(key=lambda r: r.get("final_score") or -1, reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return {"results": results, "count": len(results)}


# ── Export ────────────────────────────────────────────────────

@app.post("/api/export", tags=["Export"])
def export_results(request: ExportRequest):
    rows = []
    for loc in request.locations:
        try:
            if loc.weights:
                w = loc.weights
                weights = ScoringWeights(
                    demographic=w.get("demographic", 0.25),
                    transportation=w.get("transportation", 0.25),
                    poi_competitor=w.get("poi_competitor", 0.20),
                    land_use=w.get("land_use", 0.15),
                    environmental=w.get("environmental", 0.15),
                )
            else:
                weights = get_weights(loc.use_case)

            metrics = fetch_site_metrics(lat=loc.lat, lon=loc.lon)
            scored  = compute_final_score(metrics=metrics, weights=weights)

            row = {"lat": loc.lat, "lon": loc.lon, "use_case": loc.use_case,
                   "final_score": scored["final_score"]}
            for k, v in scored.get("breakdown", {}).items():
                row[f"breakdown_{k}"] = v
            for k, v in scored.get("constraints", {}).items():
                row[f"constraint_{k}"] = v.get("passed", "") if isinstance(v, dict) else v
            for k, v in scored.get("raw_metrics", {}).items():
                row[f"metric_{k}"] = v
            rows.append(row)
        except Exception as e:
            rows.append({"lat": loc.lat, "lon": loc.lon, "error": str(e), "final_score": None})

    rows.sort(key=lambda r: r.get("final_score") or -1, reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    df  = pd.DataFrame(rows)
    cols = ["rank"] + [c for c in df.columns if c != "rank"]
    df  = df[cols]

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    return StreamingResponse(
        buf, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gsra_ahmedabad_export.csv"},
    )
