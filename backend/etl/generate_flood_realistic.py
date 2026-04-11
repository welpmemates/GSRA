import geopandas as gpd
import numpy as np
import random

print("Loading water features...")

# Load extracted water data
water = gpd.read_file("../../data/raw/water.geojson")

print(f"Total water features: {len(water)}")

# Ensure CRS is set
if water.crs is None:
    water.set_crs("EPSG:4326", inplace=True)

# Drop invalid geometries
water = water[water.geometry.notnull()]

# SAMPLE (IMPORTANT for performance + realism)
SAMPLE_SIZE = 2000  # adjust between 1000–3000 if needed

if len(water) > SAMPLE_SIZE:
    water = water.sample(SAMPLE_SIZE, random_state=42)

print(f"Using {len(water)} water features for flood simulation")

print("Generating realistic flood zones...")

flood_polygons = []
risk_values = []

for idx, row in water.iterrows():
    geom = row.geometry

    try:
        # Determine type (more realistic buffering)
        tags = str(row)

        if "river" in tags:
            buffer_size = np.random.uniform(0.02, 0.04)   # bigger floods
            risk = np.random.uniform(0.7, 1.0)
        elif "stream" in tags:
            buffer_size = np.random.uniform(0.01, 0.025)
            risk = np.random.uniform(0.6, 0.9)
        else:
            buffer_size = np.random.uniform(0.005, 0.02)
            risk = np.random.uniform(0.5, 0.8)

        flood_zone = geom.buffer(buffer_size)

        flood_polygons.append(flood_zone)
        risk_values.append(risk)

    except Exception:
        continue

# Create GeoDataFrame
flood_gdf = gpd.GeoDataFrame(
    {"risk": risk_values},
    geometry=flood_polygons,
    crs="EPSG:4326"
)

# Remove empty geometries
flood_gdf = flood_gdf[flood_gdf.geometry.notnull()]

# OPTIONAL: explode multipolygons into individual polygons
flood_gdf = flood_gdf.explode(index_parts=False)

# Save output
output_path = "../../data/raw/gujarat_flood_zones.geojson"
flood_gdf.to_file(output_path, driver="GeoJSON")

print(f"\nSaved realistic flood zones: {output_path}")
print(f"Total zones generated: {len(flood_gdf)}")
