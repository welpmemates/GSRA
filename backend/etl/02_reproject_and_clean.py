# backend/etl/02_reproject_and_clean.py

import geopandas as gpd
import pyogrio
import shapely
from pathlib import Path
import warnings
import gc
import time
warnings.filterwarnings("ignore")

TARGET_CRS = "EPSG:32643"
RAW  = Path("../../data/raw")
PROC = Path("../../data/processed")
PROC.mkdir(exist_ok=True)

CHUNK_SIZES = {
    "Roads":       50_000,
    "Buildings":   30_000,
    "Land Use":    30_000,
    "Competitors": 100_000,
    "Flood Zones": 50_000,
}


def clean_chunk(gdf: gpd.GeoDataFrame, keep_types: list, keep_cols: list) -> gpd.GeoDataFrame | None:
    """
    Clean a single GeoDataFrame chunk.
    Uses Shapely 2.x vectorized make_valid — NO Python-level for loops.
    """
    if gdf is None or len(gdf) == 0:
        return None

    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")

    # ── Drop null / empty (vectorized) ───────────────────────────────────────
    mask = gdf.geometry.notnull() & ~gdf.geometry.is_empty
    gdf = gdf[mask]
    if len(gdf) == 0:
        return None

    # ── Fix invalid geometries — VECTORIZED (Shapely 2.x) ───────────────────
    gdf = gdf.copy()
    gdf["geometry"] = shapely.make_valid(gdf["geometry"].values)

    # ── Filter geometry types ─────────────────────────────────────────────────
    # Accept both single and Multi variants so nothing is dropped before explode
    expanded_types = []
    for t in keep_types:
        expanded_types.append(t)
        if not t.startswith("Multi"):
            expanded_types.append("Multi" + t)
    gdf = gdf[gdf.geometry.geom_type.isin(expanded_types)]
    if len(gdf) == 0:
        return None

    # ── Explode multi → single ───────────────────────────────────────────────
    gdf = gdf.explode(index_parts=False).reset_index(drop=True)

    # ── After explode, enforce single-type only ──────────────────────────────
    gdf = gdf[gdf.geometry.geom_type.isin(keep_types)]
    if len(gdf) == 0:
        return None

    # ── Keep only useful columns ─────────────────────────────────────────────
    existing = [c for c in keep_cols if c in gdf.columns]
    gdf = gdf[existing + ["geometry"]]

    # ── Reproject ────────────────────────────────────────────────────────────
    return gdf.to_crs(TARGET_CRS)


def process_layer(
    src_path: Path,
    out_path: Path,
    keep_types: list,
    keep_cols: list,
    label: str,
    row_filter: dict | None = None,
):
    """
    Stream a GeoJSON in chunks, clean each chunk, write output incrementally.
    """
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  Source : {src_path.name}")

    if not src_path.exists():
        print(f"  ⚠️  File not found — SKIPPING")
        return

    info  = pyogrio.read_info(str(src_path))
    total = info["features"]
    print(f"  Total  : {total:,} features")

    chunk_size  = CHUNK_SIZES.get(label, 50_000)
    written     = 0
    first_write = True
    t0          = time.time()

    for offset in range(0, total, chunk_size):
        chunk_gdf = pyogrio.read_dataframe(
            str(src_path),
            skip_features=offset,
            max_features=chunk_size
        )

        if row_filter:
            for col, allowed_vals in row_filter.items():
                if col in chunk_gdf.columns:
                    chunk_gdf = chunk_gdf[chunk_gdf[col].isin(allowed_vals)]

        cleaned = clean_chunk(chunk_gdf, keep_types, keep_cols)

        del chunk_gdf
        gc.collect()

        if cleaned is None or len(cleaned) == 0:
            pct     = min(offset + chunk_size, total)
            elapsed = time.time() - t0
            print(f"  {pct:>10,} / {total:,}  |  written: {written:,}  |  {elapsed:.0f}s elapsed", end="\r")
            continue

        if first_write:
            cleaned.to_file(str(out_path), driver="GeoJSON")
            first_write = False
        else:
            cleaned.to_file(str(out_path), driver="GeoJSON", mode="a")

        written += len(cleaned)
        del cleaned
        gc.collect()

        pct     = min(offset + chunk_size, total)
        elapsed = time.time() - t0
        rate    = pct / elapsed if elapsed > 0 else 0
        eta     = (total - pct) / rate if rate > 0 else 0
        print(f"  {pct:>10,} / {total:,}  |  written: {written:,}  |  {elapsed:.0f}s  |  ETA {eta:.0f}s", end="\r")

    elapsed = time.time() - t0
    print(f"\n   {written:,} features saved → {out_path.name}  ({elapsed:.0f}s total)\n")


# ─────────────────────────────────────────────────────────────────────────────
#  LAYER DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

# Roads — ways only is correct here, roads are never OSM relations
process_layer(
    src_path   = PROC / "roads.geojson",
    out_path   = PROC / "roads_clean.geojson",
    keep_types = ["LineString"],
    keep_cols  = ["highway", "name", "oneway", "maxspeed"],
    label      = "Roads",
)

# Buildings
process_layer(
    src_path   = PROC / "buildings.geojson",
    out_path   = PROC / "buildings_clean.geojson",
    keep_types = ["Polygon"],
    keep_cols  = ["building", "name"],
    label      = "Buildings",
    row_filter = {
        "building": [
            "yes", "commercial", "residential", "retail",
            "apartments", "house", "industrial", "office",
            "school", "hospital", "hotel", "warehouse",
        ]
    },
)

# Land Use
process_layer(
    src_path   = PROC / "landuse.geojson",
    out_path   = PROC / "landuse_clean.geojson",
    keep_types = ["Polygon"],
    keep_cols  = ["landuse", "name"],
    label      = "Land Use",
)

# Competitors
process_layer(
    src_path   = RAW / "gujarat_competitors_clean.geojson",
    out_path   = PROC / "competitors_clean.geojson",
    keep_types = ["Point"],
    keep_cols  = ["amenity", "shop", "name"],
    label      = "Competitors",
)

# Flood Zones
process_layer(
    src_path   = RAW / "gujarat_flood_zones.geojson",
    out_path   = PROC / "flood_clean.geojson",
    keep_types = ["Polygon"],
    keep_cols  = ["risk"],
    label      = "Flood Zones",
)

# ── Districts — small file, load fully ───────────────────────────────────────
print(f"\n{'='*60}")
print("  Districts (small file — loading fully)")
print(f"{'='*60}")
districts = gpd.read_file(RAW / "gadm41_IND_2.json")
if "GID_1" in districts.columns:
    districts = districts[districts["GID_1"].str.startswith("IND.11")]
if districts.crs is None:
    districts = districts.set_crs("EPSG:4326")
districts["geometry"] = shapely.make_valid(districts["geometry"].values)
keep = ["geometry"] + [c for c in ["NAME_1", "NAME_2", "GID_2"] if c in districts.columns]
districts = districts[keep].to_crs(TARGET_CRS)
districts.to_file(PROC / "districts_clean.geojson", driver="GeoJSON")
print(f"  ✅  {len(districts)} features → districts_clean.geojson")

print("\n" + "="*60)
print("Phase 3 Step 2 COMPLETE")
print("="*60)
print("\nFiles written to data/processed/:")
for f in sorted(PROC.glob("*_clean.geojson")):
    size_mb = f.stat().st_size / 1_048_576
    print(f"  {f.name:<35} {size_mb:>8.1f} MB")
