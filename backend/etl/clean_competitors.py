import geopandas as gpd

print("Loading competitors dataset...")

gdf = gpd.read_file("../../data/raw/gujarat_competitors.geojson")

print(f"Total features: {len(gdf)}")

# Keep only points
gdf = gdf[gdf.geometry.type == "Point"]

# Remove null geometries
gdf = gdf[gdf.geometry.notnull()]

# Optional: keep only useful columns
cols_to_keep = [col for col in gdf.columns if col in ["geometry", "amenity", "shop", "name"]]
gdf = gdf[cols_to_keep]

# Save cleaned file
output_path = "../../data/raw/gujarat_competitors_clean.geojson"
gdf.to_file(output_path, driver="GeoJSON")

print(f"Cleaned dataset saved: {output_path}")
print(f"Final features: {len(gdf)}")
