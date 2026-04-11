import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  timeout: 30000,
});

// ── Ahmedabad bounding box ────────────────────────────────────────────────────
export const AHMEDABAD_BBOX = {
  minLat: 22.95, maxLat: 23.15,
  minLon: 72.45, maxLon: 72.75,
};

export function isInsideAhmedabad(lat, lon) {
  return (
    lat >= AHMEDABAD_BBOX.minLat && lat <= AHMEDABAD_BBOX.maxLat &&
    lon >= AHMEDABAD_BBOX.minLon && lon <= AHMEDABAD_BBOX.maxLon
  );
}

// ── Weight key mapping: frontend → backend ────────────────────────────────────
// Frontend store uses: demographics, transport, competitors, zoning, environment
// Backend expects:     demographic,  transportation, poi_competitor, land_use, environmental
export function toBackendWeights(frontendWeights) {
  return {
    demographic:    frontendWeights.demographics    ?? 0.25,
    transportation: frontendWeights.transport       ?? 0.25,
    poi_competitor: frontendWeights.competitors     ?? 0.20,
    land_use:       frontendWeights.zoning          ?? 0.15,
    environmental:  frontendWeights.environment     ?? 0.15,
  };
}

// ── Use-case key mapping: frontend → backend ──────────────────────────────────
// Frontend: "Retail", "EV Charging", "Warehouse", "Telecom"
// Backend:  "retail", "ev_charging",  "warehouse", "telecom"
export function toBackendUseCase(frontendUseCase) {
  const map = {
    "Retail":      "retail",
    "EV Charging": "ev_charging",
    "Warehouse":   "warehouse",
    "Telecom":     "telecom",
  };
  return map[frontendUseCase] ?? "retail";
}

// ── Normalize backend score response → frontend shape ─────────────────────────
// Backend: { final_score, breakdown: { demographic_score, transport_score,
//             competitor_score, land_use_score, environmental_score }, raw_metrics }
// Frontend components expect: { total, demographics, transport, competitors, zoning, environment }
export function normalizeScoreResponse(data) {
  const bd = data.breakdown ?? {};
  // Sub-scores are 0–1 fractions; multiply by 100 for display
  return {
    total:        Math.min(100, Math.round(data.final_score ?? 0)),
    demographics: Math.round((bd.demographic_score   ?? 0) * 100),
    transport:    Math.round((bd.transport_score      ?? 0) * 100),
    competitors:  Math.round((bd.competitor_score     ?? 0) * 100),
    zoning:       Math.round((bd.land_use_score       ?? 0) * 100),
    environment:  Math.round((bd.environmental_score  ?? 0) * 100),
    // Pass through extras for RightPanel / deep analysis
    raw_metrics:      data.raw_metrics      ?? {},
    constraints:      data.constraints      ?? {},
    weights_applied:  data.weights_applied  ?? {},
    final_score:      data.final_score      ?? 0,
  };
}

// ── Fallbacks ─────────────────────────────────────────────────────────────────
function fallbackClusterData() {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: 4 }, (_, i) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [72.46 + i * 0.07, 22.97],
          [72.52 + i * 0.07, 22.97],
          [72.52 + i * 0.07, 23.05],
          [72.46 + i * 0.07, 23.05],
          [72.46 + i * 0.07, 22.97],
        ]],
      },
      properties: { cluster_id: i, avg_score: 50 + i * 8 },
    })),
    __fallback: true,
  };
}

function fallbackHotspotData() {
  return {
    type: "FeatureCollection",
    features: Array.from({ length: 6 }, (_, i) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          72.47 + Math.sin(i) * 0.12,
          22.97 + Math.cos(i) * 0.08,
        ],
      },
      properties: { is_hotspot: true, gi_z: 2.1 },
    })),
    __fallback: true,
  };
}

function fallbackIsochrones(lat = 23.033, lon = 72.585) {
  return [
    {
      minutes: 10,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lon - 0.04, lat - 0.02],
          [lon + 0.04, lat - 0.02],
          [lon + 0.04, lat + 0.02],
          [lon - 0.04, lat + 0.02],
          [lon - 0.04, lat - 0.02],
        ]],
      },
    },
    {
      minutes: 20,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lon - 0.08, lat - 0.04],
          [lon + 0.08, lat - 0.04],
          [lon + 0.08, lat + 0.04],
          [lon - 0.08, lat + 0.04],
          [lon - 0.08, lat - 0.04],
        ]],
      },
    },
    {
      minutes: 30,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lon - 0.13, lat - 0.06],
          [lon + 0.13, lat - 0.06],
          [lon + 0.13, lat + 0.06],
          [lon - 0.13, lat + 0.06],
          [lon - 0.13, lat - 0.06],
        ]],
      },
    },
  ];
}

function fallbackScore(lat, lon) {
  return {
    total:        Math.round(40 + Math.random() * 45),
    demographics: Math.round(Math.random() * 60 + 30),
    transport:    Math.round(Math.random() * 60 + 30),
    competitors:  Math.round(Math.random() * 60 + 20),
    zoning:       Math.round(Math.random() * 60 + 25),
    environment:  Math.round(Math.random() * 60 + 20),
    raw_metrics: {}, constraints: {}, weights_applied: {},
    final_score: 0,
    lat, lon,
    __fallback: true,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function scoreLocation(lat, lon, frontendWeights, frontendUseCase) {
  if (!isInsideAhmedabad(lat, lon)) {
    console.warn("Click outside Ahmedabad bbox — blocked");
    return null;
  }
  try {
    const response = await apiClient.post("/api/score", {
      lat,
      lon,
      use_case: toBackendUseCase(frontendUseCase ?? "Retail"),
      weights:  toBackendWeights(frontendWeights ?? {}),
    });
    if (response?.data) return normalizeScoreResponse(response.data);
    throw new Error("Empty score response");
  } catch (error) {
    console.warn("Score API failed, using fallback", error);
    return fallbackScore(lat, lon);
  }
}

export async function fetchClusters(minScore = 40, epsKm = 5) {
  try {
    const response = await apiClient.get("/api/clusters", {
      params: { min_score: minScore, eps_km: epsKm },
    });
    if (response?.data) return response.data;
    throw new Error("Empty clusters response");
  } catch (error) {
    console.warn("Clusters API failed, using fallback", error);
    return fallbackClusterData();
  }
}

export async function fetchHotspots(radiusKm = 10) {
  try {
    const response = await apiClient.get("/api/hotspots", {
      params: { radius_km: radiusKm },
    });
    if (response?.data) return response.data;
    throw new Error("Empty hotspots response");
  } catch (error) {
    console.warn("Hotspots API failed, using fallback", error);
    return fallbackHotspotData();
  }
}

// Returns array of { minutes, geometry (GeoJSON geometry) }
// Backend: POST /api/isochrone → { isochrones: [{ minutes, mode, geometry }] }
export async function fetchIsochrones(lat, lon, mode = "car", minutes = [10, 20, 30]) {
  try {
    const response = await apiClient.post("/api/isochrone", { lat, lon, mode, minutes });
    if (response?.data?.isochrones) return response.data.isochrones;
    throw new Error("Empty isochrone response");
  } catch (error) {
    console.warn("Isochrone API failed, using fallback", error);
    const fb = fallbackIsochrones(lat, lon);
    fb.__fallback = true;
    return fb;
  }
}

export async function fetchLayer(name) {
  try {
    const response = await apiClient.get(`/api/layers/${name}`);
    if (response?.data) return response.data;
    throw new Error(`Empty layer response for ${name}`);
  } catch (error) {
    console.warn(`Layer '${name}' fetch failed`, error);
    return { type: "FeatureCollection", features: [], __fallback: true };
  }
}

export async function exportResults(locations) {
  const response = await apiClient.post("/api/export", { locations }, {
    responseType: "blob",
  });
  return response.data;
}

export async function startRlOptimize() {
  return { task_id: null, message: "RL optimization is unavailable in this version." };
}

export async function getRlStatus(taskId) {
  return { status: "unknown" };
}