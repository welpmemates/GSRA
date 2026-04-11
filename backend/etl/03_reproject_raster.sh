#!/bin/bash
# backend/etl/03_reproject_raster.sh
# Run from GSRA/ root: bash backend/etl/03_reproject_raster.sh

set -e  # stop on any error

IN_TIF="data/raw/ind_ppp_2020_UNadj.tif"
OUT_DIR="data/processed"
OUT_TIF="$OUT_DIR/worldpop_utm43n.tif"

mkdir -p $OUT_DIR

echo "=== Reprojecting WorldPop Raster to UTM 43N (EPSG:32643) ==="
gdalwarp \
  -t_srs EPSG:32643 \
  -te 68.2 20.1 74.5 24.7 \
  -te_srs EPSG:4326 \
  -r bilinear \
  -co COMPRESS=LZW \
  -co BIGTIFF=YES \
  $IN_TIF \
  $OUT_TIF
echo "Done: Reprojection finished."

echo "=== Verifying Coordinate System ==="
gdalinfo $OUT_TIF | grep "Coordinate System" -A 5

echo ""
echo "Phase 3 raster reprojection complete. File saved to $OUT_TIF"