# backend/etl/04_load_postgis.py

import os
import geopandas as gpd
from sqlalchemy import create_engine, text
from pathlib import Path

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://geouser:geopass@localhost:5432/geosite")
engine = create_engine(DATABASE_URL)

PROC = Path("../../data/processed")

LAYERS = {
    "roads":       PROC / "roads_clean.geojson",
    "buildings":   PROC / "buildings_clean.geojson",
    "land_use":    PROC / "landuse_clean.geojson",
    "competitors": PROC / "competitors_clean.geojson",
    "districts":   PROC / "districts_clean.geojson",
    "flood_zones": PROC / "flood_clean.geojson",
}

for table, path in LAYERS.items():
    print(f"Loading {table}...")
    gdf = gpd.read_file(path)
    gdf = gdf.set_crs("EPSG:32643", allow_override=True)
    gdf.to_postgis(table, engine, if_exists="replace", index=False)
    print(f"  → {len(gdf):,} rows loaded into '{table}'")

# Create spatial GiST indexes
print("\nCreating spatial indexes...")
with engine.connect() as conn:
    for table in LAYERS:
        conn.execute(text(
            f"CREATE INDEX IF NOT EXISTS idx_{table}_geom ON {table} USING GIST(geometry);"
        ))
        conn.commit()
        print(f"  → Index created on {table}")

print("\nAll tables loaded with spatial indexes")
