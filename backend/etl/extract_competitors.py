import osmnx as ox
import geopandas as gpd

# Gujarat bounding box
north = 24.7
south = 20.1
east = 74.5
west = 68.2

tags = {
    "amenity": ["restaurant", "cafe", "bank", "pharmacy", "supermarket"],
    "shop": True
}

print("Fetching OSM data (this may take a few minutes)...")

bbox = (north, south, east, west)

gdf = ox.features_from_bbox(bbox, tags=tags)

print(f"Extracted {len(gdf)} features")

# Keep only points (clean dataset)
gdf = gdf[gdf.geometry.type == "Point"]

# Save
output_path = "../../data/raw/gujarat_competitors.geojson"
gdf.to_file(output_path, driver="GeoJSON")

print(f"Saved to {output_path}")
