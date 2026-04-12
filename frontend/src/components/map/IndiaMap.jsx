import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import useStore from "../../store/useStore";
import {
  scoreLocation,
  fetchClusters,
  fetchHotspots,
  fetchIsochrones,
  fetchLayer,
  AHMEDABAD_BBOX,
  isInsideAhmedabad,
} from "../../api/api";

const AHMEDABAD_CENTER = [72.5850, 23.0225];
const AHMEDABAD_ZOOM   = 12;
const MAX_BOUNDS       = [[72.35, 22.85], [72.95, 23.35]];
const EMPTY_FC         = { type: "FeatureCollection", features: [] };
const MANAGED_SOURCES  = ["points", "clusters", "hotspots", "isochrones"];

// Frontend layerId → backend layer name
const LAYER_TO_BACKEND = {
  roads: "roads",
  poi:   "competitors",
  zone:  "land_use",
  flood: "flood_zones",
  h3:    "h3_grid_res8",
};

// Persistent cache — survives re-renders
const layerCache = {};

// Convert H3 polygon features → point centroids with normalised score
function h3ToHeatmapPoints(geojson) {
  const features = (geojson?.features ?? []).flatMap((f) => {
    const score = f.properties?.avg_score;
    if (score == null) return [];
    const coords = f.geometry?.coordinates?.[0];
    if (!coords?.length) return [];
    const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    return [{
      type: "Feature",
      geometry:   { type: "Point", coordinates: [lon, lat] },
      properties: { score: Math.min(100, Math.round(score / 3)) },
    }];
  });
  return { type: "FeatureCollection", features };
}

// Safe setData helper
function setSourceData(map, id, data) {
  try { const s = map.getSource(id); if (s) s.setData(data); }
  catch (e) { console.warn("setSourceData", id, e); }
}

export default function IndiaMap() {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false);
  const markerRef    = useRef(null); // dropped pin marker

  const {
    activeLayers, overlays, weights, satelliteView,
    useCase, setPopup, addToast,
  } = useStore();

  // ─── SYNC: add/remove MapLibre layers ────────────────────────────────────
  function syncLayers(map, ov, al) {
    if (!map.isStyleLoaded()) return;

    // Heatmap
    if (ov.heatmap) {
      if (!map.getLayer("heatmap")) map.addLayer({
        id: "heatmap", type: "heatmap", source: "points",
        paint: {
          "heatmap-weight":  ["interpolate", ["linear"], ["get", "score"], 0, 0, 100, 1],
          "heatmap-radius":  ["interpolate", ["linear"], ["zoom"], 8, 20, 14, 50],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.75, 14, 0.9],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,255,0)", 0.2, "rgba(0,128,255,0.5)",
            0.4, "rgba(0,255,255,0.6)", 0.6, "rgba(255,255,0,0.8)",
            0.8, "rgba(255,128,0,0.9)", 1, "rgba(255,0,0,1)"],
        },
      });
    } else {
      if (map.getLayer("heatmap")) map.removeLayer("heatmap");
    }

    // Clusters
    if (ov.clusters) {
      if (!map.getLayer("clusters-fill")) map.addLayer({
        id: "clusters-fill", type: "fill", source: "clusters",
        paint: { "fill-color": "#FF6B6B", "fill-opacity": 0.15 },
      });
      if (!map.getLayer("clusters-line")) map.addLayer({
        id: "clusters-line", type: "line", source: "clusters",
        paint: { "line-color": "#FF6B6B", "line-width": 2 },
      });
    } else {
      if (map.getLayer("clusters-fill")) map.removeLayer("clusters-fill");
      if (map.getLayer("clusters-line")) map.removeLayer("clusters-line");
    }

    // Hotspots
    if (ov.hotspots) {
      if (!map.getLayer("hotspots")) map.addLayer({
        id: "hotspots", type: "circle", source: "hotspots",
        paint: {
          "circle-radius": 10, "circle-color": "#FFD700",
          "circle-stroke-color": "#000", "circle-stroke-width": 2, "circle-opacity": 0.85,
        },
      });
    } else {
      if (map.getLayer("hotspots")) map.removeLayer("hotspots");
    }

    // Isochrones
    if (ov.isochrones) {
      if (!map.getLayer("isochrones-fill")) map.addLayer({
        id: "isochrones-fill", type: "fill", source: "isochrones",
        paint: {
          "fill-color": ["interpolate", ["linear"], ["get", "minutes"],
            10, "#14B8A6", 20, "#3B82F6", 30, "#8B5CF6"],
          "fill-opacity": 0.2,
        },
      });
      if (!map.getLayer("isochrones-line")) map.addLayer({
        id: "isochrones-line", type: "line", source: "isochrones",
        paint: {
          "line-color": ["interpolate", ["linear"], ["get", "minutes"],
            10, "#14B8A6", 20, "#3B82F6", 30, "#8B5CF6"],
          "line-width": 1.5,
        },
      });
    } else {
      if (map.getLayer("isochrones-fill")) map.removeLayer("isochrones-fill");
      if (map.getLayer("isochrones-line")) map.removeLayer("isochrones-line");
    }

    // Data layers
    Object.keys(LAYER_TO_BACKEND).forEach((layerId) => {
      const glId     = `datalayer-${layerId}`;
      const sourceId = `datalayer-src-${layerId}`;
      const isOn     = al.includes(layerId);
      if (isOn) {
        if (!map.getSource(sourceId))
          map.addSource(sourceId, { type: "geojson", data: layerCache[layerId] ?? EMPTY_FC });
        if (!map.getLayer(glId)) {
          if (layerId === "roads")
            map.addLayer({ id: glId, type: "line", source: sourceId,
              paint: { "line-color": "#64b5f6", "line-width": 1, "line-opacity": 0.7 } });
          else if (layerId === "h3")
            map.addLayer({ id: glId, type: "fill", source: sourceId,
              paint: {
                "fill-color": ["interpolate", ["linear"], ["get", "avg_score"],
                  0, "#1a237e", 30, "#1565C0", 60, "#00897B", 85, "#00e676", 100, "#fff"],
                "fill-opacity": 0.45,
                "fill-outline-color": "rgba(0,200,200,0.25)",
              } });
          else if (layerId === "flood")
            map.addLayer({ id: glId, type: "fill", source: sourceId,
              paint: { "fill-color": "#4fc3f7", "fill-opacity": 0.3 } });
          else if (layerId === "zone")
            map.addLayer({ id: glId, type: "fill", source: sourceId,
              paint: { "fill-color": "#FFB84D", "fill-opacity": 0.25 } });
          else
            map.addLayer({ id: glId, type: "circle", source: sourceId,
              paint: { "circle-radius": 5, "circle-color": "#ef5350", "circle-opacity": 0.8 } });
        }
      } else {
        if (map.getLayer(glId)) map.removeLayer(glId);
      }
    });
  }

  // ─── DATA: populate sources ───────────────────────────────────────────────
  async function loadHeatmap(map) {
    if (!map?.isStyleLoaded()) return;
    try {
      if (!layerCache["_h3_heatmap"]) {
        const gj = await fetchLayer("h3_grid_res8");
        layerCache["_h3_heatmap"] = gj;
      }
      setSourceData(map, "points", h3ToHeatmapPoints(layerCache["_h3_heatmap"]));
    } catch (e) { console.warn("Heatmap fetch failed", e); }
  }

  async function loadClusters(map) {
    const data = await fetchClusters(120, 1.5);
    if (data.__fallback) addToast({ title: "Clusters", message: "Using fallback cluster data." });
    setSourceData(map, "clusters", data);
  }

  async function loadHotspots(map) {
    const data = await fetchHotspots();
    if (data.__fallback) addToast({ title: "Hotspots", message: "Using fallback hotspot data." });
    setSourceData(map, "hotspots", data);
  }

  async function loadIsochrones(map) {
    const raw = map.getCenter();
    const lat = Math.max(AHMEDABAD_BBOX.minLat, Math.min(AHMEDABAD_BBOX.maxLat, raw.lat));
    const lon = Math.max(AHMEDABAD_BBOX.minLon, Math.min(AHMEDABAD_BBOX.maxLon, raw.lng));
    const isoArray = await fetchIsochrones(lat, lon, "car", [10, 20, 30]);
    const features = (Array.isArray(isoArray) ? isoArray : []).flatMap((iso) =>
      iso.geometry
        ? [{ type: "Feature", geometry: iso.geometry, properties: { minutes: iso.minutes } }]
        : []
    );
    setSourceData(map, "isochrones", { type: "FeatureCollection", features });
    if (!features.length)
      addToast({ title: "Isochrones", message: "No geometry returned — OSRM may be offline, showing fallback." });
  }

  async function loadDataLayers(map) {
    for (const [layerId, backendName] of Object.entries(LAYER_TO_BACKEND)) {
      const sourceId = `datalayer-src-${layerId}`;
      if (!map.getSource(sourceId)) continue;
      if (layerCache[layerId]) {
        setSourceData(map, sourceId, layerCache[layerId]);
        continue;
      }
      try {
        const gj = await fetchLayer(backendName);
        layerCache[layerId] = gj;
        setSourceData(map, sourceId, gj);
      } catch (e) { console.warn("fetchLayer failed:", backendName, e); }
    }
  }

  // ─── Full refresh: sync layers THEN load data ─────────────────────────────
  function fullRefresh(map, ov, al) {
    if (!map?.isStyleLoaded()) return;
    syncLayers(map, ov, al);
    if (ov.heatmap)     loadHeatmap(map);
    if (ov.clusters)    loadClusters(map);    else setSourceData(map, "clusters",   EMPTY_FC);
    if (ov.hotspots)    loadHotspots(map);    else setSourceData(map, "hotspots",   EMPTY_FC);
    if (ov.isochrones)  loadIsochrones(map);  else setSourceData(map, "isochrones", EMPTY_FC);
    loadDataLayers(map);
  }

  // ─── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: satelliteView
        ? "https://tiles.stadiamaps.com/styles/alidade_satellite.json"
        : "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
      center: AHMEDABAD_CENTER, zoom: AHMEDABAD_ZOOM,
      maxBounds: MAX_BOUNDS, attributionControl: true, preserveDrawingBuffer: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      loadedRef.current = true;
      MANAGED_SOURCES.forEach((id) => map.addSource(id, { type: "geojson", data: EMPTY_FC }));
      // Read current state from store via closure at init time
      fullRefresh(map, overlays, activeLayers);
    });

    map.on("style.load", () => {
      if (!loadedRef.current) return;
      MANAGED_SOURCES.forEach((id) => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY_FC }); });
      fullRefresh(map, overlays, activeLayers);
    });

    map.on("click", async (e) => {
      const { lat, lng: lon } = e.lngLat;
      if (!isInsideAhmedabad(lat, lon)) {
        addToast({ title: "Out of bounds", message: "Please click within Ahmedabad." });
        return;
      }

      // ── Drop pin immediately at click location ──────────────────
      if (markerRef.current) markerRef.current.remove();
      const el = document.createElement("div");
      el.innerHTML = `
        <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="pshadow" x="-40%" y="-20%" width="180%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.35)"/>
            </filter>
          </defs>
          <g filter="url(#pshadow)">
            <path d="M16 2 C8.268 2 2 8.268 2 16 C2 24 16 40 16 40 C16 40 30 24 30 16 C30 8.268 23.732 2 16 2 Z"
              fill="#14B8A6" stroke="#0D9488" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="6" fill="white" opacity="0.95"/>
          </g>
        </svg>`;
      el.style.cssText = "cursor:pointer; animation: pinDrop 0.3s cubic-bezier(0.34,1.56,0.64,1)";
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lon, lat])
        .addTo(map);

      try {
        const scoreData = await scoreLocation(lat, lon, weights, useCase);
        if (!scoreData) return;
        if (scoreData.__fallback) addToast({ title: "Server fallback", message: "Scoring API unavailable." });
        setPopup({ x: e.point.x, y: e.point.y, lat, lng: lon, score: scoreData });
      } catch { addToast({ title: "Score error", message: "Unable to retrieve score." }); }
    });

    return () => { loadedRef.current = false; map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── React to overlay / layer changes ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    fullRefresh(map, overlays, activeLayers);
  }, [overlays, activeLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Satellite toggle ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(satelliteView
      ? "https://tiles.stadiamaps.com/styles/alidade_satellite.json"
      : "https://tiles.stadiamaps.com/styles/alidade_smooth.json");
  }, [satelliteView]);

  return (
    <div ref={containerRef} className="absolute inset-0"
      style={{ background: "#FFFFFF", pointerEvents: "auto" }}>
      <style>{`
        .maplibregl-canvas-container { position: absolute; inset: 0; width: 100%; height: 100%; }
        .maplibregl-canvas { width: 100% !important; height: 100% !important; }
        .maplibregl-ctrl-logo, .maplibregl-ctrl-bottom-right { display: none !important; }
        @keyframes pinDrop {
          0%   { transform: translateY(-24px) scale(0.7); opacity: 0; }
          70%  { transform: translateY(4px)   scale(1.08); opacity: 1; }
          100% { transform: translateY(0)     scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}