# backend/app/db/spatial_queries.py

from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://geouser:geopass@localhost:5432/geosite")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# ── Point construction helper (used in every query) ───────────────────────────
# ALWAYS transforms WGS84 input → EPSG:32643 (UTM 43N) before spatial ops
_POINT = "ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 32643)"

# Ahmedabad bounding box (UTM 32643)
AHMEDABAD_FILTER = """
ST_Intersects(
    geometry,
    ST_Transform(
        ST_MakeEnvelope(72.45, 22.95, 72.75, 23.15, 4326),
        32643
    )
)
"""


def fetch_site_metrics(lat: float, lon: float) -> dict:
    """
    Run all spatial queries against PostGIS and return raw metric values.

    All distances are in metres (EPSG:32643 is metric).
    Returns:
        {
            "pop_5km":              float,  # building count proxy within 5 km
            "road_count_1km":       int,    # road segments within 1 km
            "competitor_count_2km": int,    # competitor POIs within 2 km
            "flood_risk":           float,  # avg flood risk score [0–1], 0 if none
            "commercial_land_pct":  float,  # fraction of 1 km buffer that is commercial [0–1]
            "in_restricted_zone":   bool,   # True if inside a restricted land-use zone
        }
    """
    params = {"lat": lat, "lon": lon}

    with engine.connect() as conn:

        # ── 1. Population proxy: count buildings within 5 km ─────────────────
        pop_result = conn.execute(text(f"""
            SELECT COUNT(*) AS pop_proxy
            FROM   buildings
            WHERE  ST_DWithin(geometry, {_POINT}, 5000)
            AND {AHMEDABAD_FILTER}
        """), params).fetchone()
        pop_5km = float(pop_result.pop_proxy) if pop_result else 0.0

        # ── 2. Road density: segment count within 1 km ───────────────────────
        road_result = conn.execute(text(f"""
            SELECT COUNT(*) AS road_count
            FROM   roads
            WHERE  ST_DWithin(geometry, {_POINT}, 1000)
            AND {AHMEDABAD_FILTER}
        """), params).fetchone()
        road_count_1km = int(road_result.road_count) if road_result else 0

        # ── 3. Competitor density: POI count within 2 km ─────────────────────
        comp_result = conn.execute(text(f"""
            SELECT COUNT(*) AS comp_count
            FROM   competitors
            WHERE  ST_DWithin(geometry, {_POINT}, 2000)
            AND {AHMEDABAD_FILTER}
        """), params).fetchone()
        competitor_count_2km = int(comp_result.comp_count) if comp_result else 0

        # ── 4. Flood risk: average risk score of intersecting flood zones ─────
        flood_result = conn.execute(text(f"""
            SELECT COALESCE(AVG(risk), 0) AS avg_flood_risk
            FROM   flood_zones
            WHERE  ST_Intersects(geometry, {_POINT})
            AND {AHMEDABAD_FILTER}
        """), params).fetchone()
        flood_risk = float(flood_result.avg_flood_risk) if flood_result else 0.0

        # ── 5. Commercial land use fraction within 1 km ───────────────────────
        # buf_area isolates the buffer area as a scalar subquery so the outer
        # SELECT can use it in division without triggering a GROUP BY error.
        land_result = conn.execute(text(f"""
            WITH buf AS (
                SELECT ST_Buffer({_POINT}, 1000) AS geom
            ),
            buf_area AS (
                SELECT ST_Area(geom) AS area FROM buf
            ),
            commercial AS (
                SELECT ST_Area(ST_Intersection(lu.geometry, buf.geom)) AS clipped_area
                FROM   land_use lu, buf
                WHERE  lu.landuse IN (
                           'commercial', 'retail', 'industrial',
                           'office', 'mixed_use'
                       )
                  AND  ST_Intersects(lu.geometry, buf.geom)
                  AND {AHMEDABAD_FILTER}
            )
            SELECT
                COALESCE(
                    SUM(clipped_area) / NULLIF((SELECT area FROM buf_area), 0),
                    0
                ) AS commercial_fraction
            FROM commercial
        """), params).fetchone()
        commercial_land_pct = float(land_result.commercial_fraction) if land_result else 0.0
        commercial_land_pct = min(commercial_land_pct, 1.0)  # cap at 100%

        # ── 6. Restricted zone check ──────────────────────────────────────────
        restricted_result = conn.execute(text(f"""
            SELECT EXISTS (
                SELECT 1
                FROM   land_use
                WHERE  landuse IN ('forest', 'nature_reserve', 'military',
                                   'conservation', 'protected_area')
                  AND  ST_Intersects(geometry, {_POINT})
                  AND {AHMEDABAD_FILTER}
            ) AS is_restricted
        """), params).fetchone()
        in_restricted_zone = bool(restricted_result.is_restricted) if restricted_result else False

    return {
        "pop_5km":              pop_5km,
        "road_count_1km":       road_count_1km,
        "competitor_count_2km": competitor_count_2km,
        "flood_risk":           flood_risk,
        "commercial_land_pct":  commercial_land_pct,
        "in_restricted_zone":   in_restricted_zone,
    }
