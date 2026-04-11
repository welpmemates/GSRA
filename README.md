# GeoSpatial Site Readiness Analyzer (GSRA)

An AI-powered geospatial decision system that evaluates optimal site locations across the state of Gujarat, India.

GSRA combines **PostGIS spatial queries**, **multi-layer geospatial data**, and **mathematical scoring models** to compute a **Site Readiness Score (0–100)** for any given location.

---

# What This Project Does

Given a latitude and longitude, the system:

* Fetches spatial data from a PostGIS database
* Computes key metrics:

  * Population density (proxy)
  * Road accessibility
  * Competitor density
  * Land use suitability
  * Environmental risk (flood)
* Applies:

  * AHP-based weighted scoring
  * Distance decay functions
  * Gaussian competitor modeling
  * Constraint-based filtering

### Output:

```json
{
  "final_score": 42.18,
  "breakdown": {...},
  "constraints": {...},
  "weights_applied": {...},
  "raw_metrics": {...}
}
```

---

# What Has Been Completed (Phase 0 → Phase 6)

## Phase 0 — Project Setup

* Monorepo structure created
* Tech stack finalized

## Phase 1 — Environment Setup

* PostgreSQL + PostGIS installed
* FastAPI backend initialized
* React frontend scaffolded

## Phase 2 — Data Acquisition

* OSM PBF (Western India)
* District boundaries (GADM)
* WorldPop population raster
* Competitor dataset (POIs)
* Air Quality data (OpenAQ)
* Flood dataset (synthetic)

## Phase 3 — ETL Pipeline

* OSM extraction using `osmium-tool`
* CRS standardization → **EPSG:32643**
* Geometry cleaning (Shapely, GeoPandas)
* PostGIS loading (1M+ features)
* Spatial indexing (GiST)
* H3 grid generation (resolution 7 & 8)

## Phase 4 — Scoring Engine

* AHP weight system
* PostGIS-based metric extraction
* Normalization + decay functions
* Gaussian competitor scoring
* Constraint-based filtering
* `/api/score` endpoint (fully functional)

## Phase 5 — Backend API Expansion

* POST `/api/score` → Site readiness scoring
* GET `/api/layers/{name}` → Raw spatial data (GeoJSON)
* GET `/api/clusters` → DBSCAN-based cluster detection
* GET `/api/hotspots` → Getis-Ord Gi* hotspot detection
* POST `/api/isochrone` → Travel-time polygons (OSRM)
* POST `/api/compare` → Multi-location comparison
* POST `/api/export` → CSV export

## Phase 6 — Spatial Analysis

* H3 aggregation
* DBSCAN clustering
* Getis-Ord Gi* hotspot detection

---

# Project Structure

```
GSRA/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   │
│   │   ├── scripts/
│   │   │   └── score_h3_grid.py
│   │   │
│   │   ├── scoring/
│   │   │   ├── __init__.py
│   │   │   ├── engine.py
│   │   │   └── weights.py
│   │   │
│   │   ├── routing/
│   │   │   ├── __init__.py
│   │   │   └── isochrone.py
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   └── spatial_queries.py
│   │   │
│   │   └── clustering/
│   │       ├── __init__.py
│   │       ├── dbscan_clusters.py
│   │       └── gi_star.py
│   │
│   ├── etl/
│   │   ├── 01_extract_osm.sh
│   │   ├── 02_reproject_and_clean.py
│   │   ├── 03_reproject_raster.sh
│   │   ├── 04_load_postgis.py
│   │   ├── 05_generate_h3_grid.py
│   │   ├── clean_competitors.py
│   │   ├── download_aq_data.py
│   │   └── generate_flood_realistic.py
|   |
│   ├── .env
│   └── requirements.txt
|
├── frontend/
|
├── data/
│   ├── raw/
│   └── processed/
|
├── martin
└── README.md
```

---

# Environment Setup

## 1. Clone Repository

```bash
git clone https://github.com/welpmemates/GSRA.git
cd GSRA
```

---

## 2. Install PostgreSQL + PostGIS

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib postgis
```

---

## 3. Create Database

```bash
sudo -u postgres psql <<EOF
CREATE USER geouser WITH PASSWORD 'geopass';
CREATE DATABASE geosite OWNER geouser;
\c geosite
CREATE EXTENSION postgis;
EOF
```

---

## 4. Setup Backend

```bash
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

---

## 5. Install System Dependencies

```bash
sudo apt install osmium-tool gdal-bin
```

---

# Data Setup (IMPORTANT)

Place all datasets in:

```
data/raw/
```

Required files:

* `western-zone-latest.osm.pbf`
* `gadm41_IND_2.json`
* `ind_ppp_2020_UNadj.tif`
* `gujarat_competitors_clean.geojson`
* `gujarat_flood_zones.geojson`

---

# ETL Pipeline (Run Once)

Run in order:

```bash
cd backend/etl

bash 01_extract_osm.sh
python 02_reproject_and_clean.py
bash 03_reproject_raster.sh
python 04_load_postgis.py
python 05_generate_h3_grid.py
```

---

# Verify Setup

## 1. Check DB Connection

```bash
psql -U geouser -d geosite
```

Run:

```sql
SELECT COUNT(*) FROM roads;
SELECT COUNT(*) FROM buildings;
```

---

## 2. Check CRS

```sql
SELECT f_table_name, srid FROM geometry_columns;
```

👉 All should be:

```
32643
```

---

## 3. Test Spatial Query

```sql
SELECT COUNT(*)
FROM roads
WHERE ST_DWithin(
  geometry,
  ST_Transform(ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 32643),
  1000
);
```

---

# Run the Backend

```bash
cd backend
source venv/bin/activate

uvicorn app.main:app --reload --port 8000
```

Open:

http://localhost:8000/docs

---

# Demo Example

### Request:

```bash
curl -X POST http://localhost:8000/api/score \
  -H "Content-Type: application/json" \
  -d '{"lat": 23.0225, "lon": 72.5714, "use_case": "retail"}'
```

---

### Response:

```json
{
  "final_score": 42.18,
  "breakdown": {
    "demographic_score": 0.5046,
    "transport_score": 0.7348,
    "competitor_score": 0.0,
    "land_use_score": 0.0765,
    "environmental_score": 1.0
  },
  "constraints": {
    "min_population_met": true,
    "not_in_restricted_zone": true
  }
}
```

---

# Interpretation

* Moderate population → decent score
* Strong road access → high transport score
* High competition → score drops significantly
* Low flood risk → good environmental score

Final score reflects **real-world trade-offs**

---

# What’s Left (Upcoming Phases)

## Phase 7 — Frontend Map UI

* MapLibre integration
* Click-to-score interaction
* Layer toggles
* Score visualization (charts)

## Phase 8 — Advanced ML (RL Optimizer)

* PPO-based site selection
* Multi-location optimization
* Coverage vs competition balancing

## Phase 9 — Enterprise Features

* CSV upload
* Schema auto-mapping
* Custom region analysis
* Report export (CSV/PDF)

## Phase 10 — Compliance & Optimization

* National Geospatial Policy (NGP 2022)
* Data anonymization (k-anonymity)
* Query optimization
* Logging & error handling

## Phase 11 — Testing & Debugging

* API testing
* Spatial query validation
* CRS verification
* Edge case handling

## Phase 12 — Final Documentation & Demo

* README finalization
* Architecture diagram
* Demo preparation
* Screenshots & results

---

# Key Highlights

* Full Gujarat-scale geospatial system
* 1M+ spatial features processed
* Real-time scoring via PostGIS
* Explainable AI scoring model
* Production-ready backend

---

# Notes

* All spatial operations use **EPSG:32643 (UTM Zone 43N)**
* Distance calculations are in **meters**
* Population is approximated using **building density proxy**

---
