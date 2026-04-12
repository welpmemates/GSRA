# GeoSpatial Site Readiness Analyzer (GSRA)

An AI-powered geospatial decision system designed to evaluate **site suitability across Ahmedabad, India**.

GSRA combines **PostGIS spatial queries**, **multi-layer geospatial data**, and an **AHP-based scoring engine**, enhanced with an **AI-inspired optimization layer** to compute a **Site Readiness Score (0–100)** for any location.

---

## What This Project Does

Given a latitude and longitude, GSRA:

- Extracts real-time spatial metrics from PostGIS
- Evaluates:
  - Population density
  - Road accessibility
  - Competitor density
  - Land use suitability
  - Environmental risk (flood)
- Applies:
  - AHP-based weighted scoring
  - Distance decay models
  - Gaussian competitor modeling
  - Constraint-based filtering
- Returns a normalized suitability score (0–100) with a detailed breakdown of contributing factors
- Unlike traditional GIS tools, GSRA focuses on decision-making rather than visualization by combining scoring, spatial analytics, and optimization

### Output

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

## Intelligence Layer

GSRA includes an **AI-inspired optimization module** that:

- Automatically adjusts scoring weights
- Maximizes suitability score for a given location + use-case
- Uses lightweight search (random + evolutionary strategies)
- Inspired by reinforcement learning concepts:
  - **State** → location + metrics
  - **Action** → weight selection
  - **Reward** → final score

This transforms GSRA from a static scoring tool into an **adaptive, context-aware decision system**.

---

## Retail Intelligence

GSRA supports **retail subcategories** with distinct spatial priorities:

- Grocery Store
- Clothing Store
- Electronics Store
- Pharmacy
- Luxury Retail

Each subcategory uses tailored scoring weights for more realistic business decision-making.

---

## Key Features

- Multi-layer geospatial data fusion
- AHP-based explainable scoring system
- Click-based real-time scoring
- H3 hex-based heatmap visualization
- DBSCAN clustering + hotspot detection
- Isochrone-based accessibility analysis (OSRM)
- Use-case presets + adjustable weights
- Auto Optimize (AI layer)
- Site comparison + export

---

## Architecture

**Dual Scoring System:**

| Mode | Purpose |
|------|---------|
| Heatmap (Static) | Fast exploration across the map |
| Click Scoring (Dynamic) | Precise, real-time decision-making |

This ensures high performance, real-time interaction, and scalable computation.

---

## Project Structure

```
GSRA/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── optimizer.py
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
│   ├── processed/
│   └── get_data.txt/                   # Link to all the datasets for the both raw/ and processed/
|
├── martin
└── README.md

This separation ensures scalability by avoiding expensive recomputation across thousands of spatial cells.
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/welpmemates/GSRA.git
cd GSRA
```

### 2. Install PostgreSQL + PostGIS

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib postgis
```

### 3. Create Database

```bash
sudo -u postgres psql <<EOF
CREATE USER geouser WITH PASSWORD 'geopass';
CREATE DATABASE geosite OWNER geouser;
\c geosite
CREATE EXTENSION postgis;
EOF
```

### 4. Setup Backend

```bash
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Install System Dependencies

```bash
sudo apt install osmium-tool gdal-bin
```

---

## Data Setup

Place all datasets in:

```
data/raw/
```

Required files:

| File | Description |
|------|-------------|
| `western-zone-latest.osm.pbf` | OSM road and building data |
| `gadm41_IND_2.json` | District boundaries (GADM) |
| `ind_ppp_2020_UNadj.tif` | WorldPop population raster |
| `gujarat_competitors_clean.geojson` | Competitor POI dataset |
| `gujarat_flood_zones.geojson` | Flood risk zones |

---

## ETL Pipeline (Run Once)

Run scripts in order:

```bash
cd backend/etl

bash 01_extract_osm.sh
python 02_reproject_and_clean.py
bash 03_reproject_raster.sh
python 04_load_postgis.py
python 05_generate_h3_grid.py
```

---

## Verify Setup

### Check DB Connection

```bash
psql -U geouser -d geosite
```

```sql
SELECT COUNT(*) FROM roads;
SELECT COUNT(*) FROM buildings;
```

### Check CRS

```sql
SELECT f_table_name, srid FROM geometry_columns;
```

All tables should return SRID `32643`.

### Test Spatial Query

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

## Run the Backend

```bash
cd backend
source venv/bin/activate

uvicorn app.main:app --reload --port 8000
```

API docs available at: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Example API Call

```bash
curl -X POST http://localhost:8000/api/score \
  -H "Content-Type: application/json" \
  -d '{"lat": 23.0225, "lon": 72.5714, "use_case": "retail"}'
```

### Response

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

### Interpretation

| Factor | Result | Meaning |
|--------|--------|---------|
| Demographic | 0.50 | Moderate population density |
| Transport | 0.73 | Strong road accessibility |
| Competitor | 0.00 | High competition — score penalized |
| Land Use | 0.08 | Low suitability in this zone |
| Environmental | 1.00 | No flood risk detected |

> Final score reflects **real-world trade-offs** across all factors.

---

## 📋 Completed Phases

### Phase 0 — Project Setup
- Monorepo structure created
- Tech stack finalized

### Phase 1 — Environment Setup
- PostgreSQL + PostGIS installed
- FastAPI backend initialized
- React frontend scaffolded

### Phase 2 — Data Acquisition
- OSM PBF (Western India)
- District boundaries (GADM)
- WorldPop population raster
- Competitor dataset (POIs)
- Air Quality data (OpenAQ)
- Flood dataset (synthetic)

### Phase 3 — ETL Pipeline
- OSM extraction using `osmium-tool`
- CRS standardization → **EPSG:32643**
- Geometry cleaning (Shapely, GeoPandas)
- PostGIS loading (1M+ features)
- Spatial indexing (GiST)
- H3 grid generation (resolution 7 & 8)

### Phase 4 — Scoring Engine
- AHP weight system
- PostGIS-based metric extraction
- Normalization + decay functions
- Gaussian competitor scoring
- Constraint-based filtering
- `/api/score` endpoint (fully functional)

### Phase 5 — Backend API Expansion

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/score` | POST | Site readiness scoring |
| `/api/layers/{name}` | GET | Raw spatial data (GeoJSON) |
| `/api/clusters` | GET | DBSCAN-based cluster detection |
| `/api/hotspots` | GET | Getis-Ord Gi* hotspot detection |
| `/api/isochrone` | POST | Travel-time polygons (OSRM) |
| `/api/compare` | POST | Multi-location comparison |
| `/api/export` | POST | CSV export |

### Phase 6 — Spatial Analysis
- H3 aggregation
- DBSCAN clustering
- Getis-Ord Gi* hotspot detection

### Phase 7 — Frontend Map UI
- MapLibre integration
- Click-to-score interaction
- Layer toggles
- Score visualization (charts)
- Report export (CSV/PDF)

### Phase 8 — Advanced ML (RL Optimizer)
- RL-inspired weight optimization (gradient-free)
- Automatic weight tuning for a given location + use-case
- Maximizes site suitability score using existing scoring engine

---

## Compliance

GSRA is designed with awareness of India's **National Geospatial Policy (NGP 2022)** and responsible data usage practices.

- Uses **open-source and publicly available datasets** (OSM, WorldPop, OpenAQ), ensuring no licensing violations
- Avoids handling **personally identifiable information (PII)** — all analysis is performed on aggregated spatial data
- All outputs are **location-based insights**, not individual-level data
- System is suitable for **planning and decision support**, not surveillance or personal tracking

This ensures the platform remains compliant, ethical, and safe for real-world deployment.

---

## Key Highlights

- Interactive frontend with real-time weight adjustment and auto-optimization
- Enabling fine-grained decision-making across different retail business types
- Ahmedabad-focused geospatial intelligence system
- 1M+ spatial features processed
- Sub-second scoring using PostGIS
- Explainable AI scoring model
- Adaptive weight optimization
- Production-ready architecture

---

## Notes

- **CRS:** EPSG:32643 (UTM Zone 43N)
- **Distance calculations:** All in meters
- **Population:** Approximated via building density proxy