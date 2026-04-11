#!/bin/bash
# backend/etl/01_extract_osm.sh
# Run from GSRA/ root: bash backend/etl/01_extract_osm.sh

set -e  # stop on any error

PBF="data/raw/western-zone-latest.osm.pbf"
OUT="data/processed"

mkdir -p $OUT

echo "=== Extracting Roads ==="
osmium tags-filter $PBF w/highway -o $OUT/roads.osm.pbf --overwrite
osmium export $OUT/roads.osm.pbf -o $OUT/roads.geojson --overwrite
echo "Done: roads.geojson"

echo "=== Extracting Buildings ==="
osmium tags-filter $PBF wr/building -o $OUT/buildings.osm.pbf --overwrite
osmium export $OUT/buildings.osm.pbf --geometry-types=polygon -o $OUT/buildings.geojson --overwrite
echo "Done: buildings.geojson"

echo "=== Extracting Land Use ==="
osmium tags-filter $PBF wr/landuse -o $OUT/landuse.osm.pbf --overwrite
osmium export $OUT/landuse.osm.pbf --geometry-types=polygon -o $OUT/landuse.geojson --overwrite
echo "Done: landuse.geojson"

echo "=== Extracting Water ==="
osmium tags-filter $PBF wr/natural=water wr/waterway -o $OUT/water.osm.pbf --overwrite
osmium export $OUT/water.osm.pbf --geometry-types=polygon,linestring -o $OUT/water_raw.geojson --overwrite
echo "Done: water_raw.geojson"

echo ""
echo "Phase 1 extraction complete. Files in data/processed/"