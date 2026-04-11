import os
import geopandas as gpd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

from app.db.spatial_queries import fetch_site_metrics
from app.scoring.engine import compute_final_score
from app.scoring.weights import USE_CASE_PRESETS

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

USE_CASE = "retail"


def main():
    print("📥 Loading H3 grid (res8)...")

    gdf = gpd.read_postgis(
        "SELECT h3_id, geometry FROM h3_grid_res8",
        engine,
        geom_col="geometry"
    )

    print(f"Total hexes: {len(gdf)}")

    weights = USE_CASE_PRESETS[USE_CASE]

    scores = []

    for i, row in gdf.iterrows():
        geom = row["geometry"]

        # Convert to WGS84 FIRST
        centroid_wgs84 = gpd.GeoSeries([geom.centroid], crs="EPSG:32643").to_crs("EPSG:4326")[0]

        lat, lon = centroid_wgs84.y, centroid_wgs84.x

        try:
            metrics = fetch_site_metrics(lat, lon)
            result = compute_final_score(metrics, weights)

            scores.append(result["final_score"])

        except Exception as e:
            print(f"❌ Error at {i}: {e}")
            scores.append(0.0)

        if i % 1000 == 0:
            print(f"⏳ Processed {i}/{len(gdf)}")

    gdf["avg_score"] = scores

    print("📤 Writing scores back to PostGIS...")

    gdf[["h3_id", "avg_score", "geometry"]].to_postgis(
        "h3_scores_temp",
        engine,
        if_exists="replace",
        index=False
    )

    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE h3_grid_res8 h
            SET avg_score = s.avg_score
            FROM h3_scores_temp s
            WHERE h.h3_id = s.h3_id;
        """))

        conn.execute(text("DROP TABLE h3_scores_temp"))

    print("✅ DONE: H3 grid scored successfully!")


if __name__ == "__main__":
    main()
