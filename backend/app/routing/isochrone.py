# backend/app/routing/isochrone.py
#
# Generates drive-time / walk-time isochrone polygons by:
#   1. Creating a grid of candidate points around the origin
#   2. Calling the local OSRM /table endpoint for travel durations
#   3. Filtering reachable points, building a convex-hull polygon
#
# Requires OSRM to be running locally:
#   Car  → osrm-routed --algorithm mld -p 5000 data/osrm/car/...osrm
#   Foot → osrm-routed --algorithm mld -p 5001 data/osrm/foot/...osrm

import os
import math
import httpx
import numpy as np
from shapely.geometry import MultiPoint, mapping
from shapely.ops import unary_union

OSRM_CAR_URL  = os.getenv("OSRM_CAR_URL",  "http://localhost:5000")
OSRM_FOOT_URL = os.getenv("OSRM_FOOT_URL", "http://localhost:5001")

# Approximate speeds used for grid sizing (metres per second)
_SPEED_MS = {"car": 13.0, "foot": 1.4}

# Number of grid points along each axis — higher = smoother polygon, slower
_GRID_POINTS = 20


def _make_grid(lat: float, lon: float, max_dist_m: float) -> list[tuple[float, float]]:
    """
    Return a uniform grid of (lat, lon) pairs within a square of side
    2 * max_dist_m centred on (lat, lon).
    """
    offsets = np.linspace(-max_dist_m, max_dist_m, _GRID_POINTS)

    # 1 degree latitude ≈ 111 320 m
    # 1 degree longitude ≈ 111 320 * cos(lat) m
    lat_per_m = 1.0 / 111_320.0
    lon_per_m = 1.0 / (111_320.0 * math.cos(math.radians(lat)))

    points = []
    for dy in offsets:
        for dx in offsets:
            pt_lat = lat + dy * lat_per_m
            pt_lon = lon + dx * lon_per_m
            points.append((pt_lat, pt_lon))

    return points


async def compute_isochrone(
    lat: float,
    lon: float,
    mode: str,          # "car" | "foot"
    minutes: list[int], # e.g. [10, 20, 30]
    timeout_s: float = 30.0,
) -> list[dict]:
    """
    Compute isochrone polygons for each duration in *minutes*.

    Returns a list of dicts, one per duration:
        {
            "minutes":  int,
            "mode":     str,
            "geometry": GeoJSON geometry dict  (Polygon or None)
        }

    If OSRM is unreachable, returns empty geometry dicts without crashing.
    """
    base_url = OSRM_CAR_URL if mode == "car" else OSRM_FOOT_URL
    speed_ms = _SPEED_MS.get(mode, 1.4)

    results = []

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        for mins in sorted(minutes):
            max_dist_m = mins * 60 * speed_ms
            grid_pts   = _make_grid(lat, lon, max_dist_m)

            # OSRM coordinate string: "lon,lat;lon,lat;..."
            # Source is the first coordinate (index 0)
            src_coord  = f"{lon},{lat}"
            grid_str   = ";".join(f"{p[1]},{p[0]}" for p in grid_pts)
            all_coords = f"{src_coord};{grid_str}"

            url = (
                f"{base_url}/table/v1/{mode}/{all_coords}"
                f"?sources=0&annotations=duration"
            )

            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()

                # durations[0] is a list; skip index 0 (source→source = 0)
                raw_durations = data.get("durations", [[]])[0]
                durations = raw_durations[1:]  # skip self

                reachable = [
                    (grid_pts[i][1], grid_pts[i][0])  # (lon, lat) for Shapely
                    for i, d in enumerate(durations)
                    if d is not None and d <= mins * 60
                ]

                if len(reachable) >= 3:
                    mp   = MultiPoint(reachable)
                    hull = mp.convex_hull.buffer(0.005)  # small buffer for smooth edge
                    geom = mapping(hull)
                else:
                    geom = None

            except Exception:
                # OSRM not running or request failed — return null geometry
                geom = None

            results.append({
                "minutes":  mins,
                "mode":     mode,
                "geometry": geom,
            })

    return results
