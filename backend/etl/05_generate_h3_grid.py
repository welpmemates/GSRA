# backend/etl/05_generate_h3_grid.py

import h3
import geopandas as gpd
import pandas as pd
from shapely.geometry import Polygon
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://geouser:geopass@localhost:5432/geosite")
engine = create_engine(DATABASE_URL)

# Gujarat bounding box in WGS84
GUJARAT_BBOX = {
    "type": "Polygon",
    "coordinates": [[
        [68.2, 20.1], [74.5, 20.1],
        [74.5, 24.7], [68.2, 24.7],
        [68.2, 20.1]
    ]]
}

def build_h3_grid(resolution: int) -> gpd.GeoDataFrame:
    hex_ids = h3.polyfill_geojson(GUJARAT_BBOX, resolution)
    print(f"  Resolution {resolution}: {len(hex_ids):,} cells")

    rows = []
    for hid in hex_ids:
        coords = h3.h3_to_geo_boundary(hid, geo_json=True)
        rows.append({"h3_id": hid, "geometry": Polygon(coords)})

    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326")
    return gdf.to_crs("EPSG:32643")

for res, table in [(7, "h3_grid_res7"), (8, "h3_grid_res8")]:
    print(f"Generating H3 grid resolution {res}...")
    grid = build_h3_grid(res)
    grid.to_postgis(table, engine, if_exists="replace", index=False)
    print(f"  → Loaded into '{table}'")

# Spatial indexes on H3 grids
with engine.connect() as conn:
    for table in ["h3_grid_res7", "h3_grid_res8"]:
        conn.execute(text(
            f"CREATE INDEX IF NOT EXISTS idx_{table}_geom ON {table} USING GIST(geometry);"
        ))
        conn.commit()

print("\nH3 grids generated and indexed")
