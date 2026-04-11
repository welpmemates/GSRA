import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import useStore from "../../store/useStore";
import { scoreLocation, fetchClusters, fetchHotspots, fetchIsochrones, AHMEDABAD_BBOX, isInsideAhmedabad } from "../../api/api";

// ── Ahmedabad center & zoom ───────────────────────────────────────────────────
const AHMEDABAD_CENTER = [72.5850, 23.0225]; // lon, lat
const AHMEDABAD_ZOOM   = 12;

// Max bounds: slightly wider than bbox so the map doesn't feel locked
const MAX_BOUNDS = [
  [72.35, 22.85], // SW
  [72.95, 23.35], // NE
];

// Empty FeatureCollection helper
const EMPTY_FC = { type: "FeatureCollection", features: [] };

// All source IDs we manage
const MANAGED_SOURCES = ["points", "clusters", "hotspots", "isochrones"];

// ── Heatmap-style mock points (Ahmedabad bbox only) ───────────────────────────
function generatePoints(count = 300) {
  const features = [];
  for (let i = 0; i < count; i++) {
    const lon   = AHMEDABAD_BBOX.minLon + Math.random() * (AHMEDABAD_BBOX.maxLon - AHMEDABAD_BBOX.minLon);
    const lat   = AHMEDABAD_BBOX.minLat + Math.random() * (AHMEDABAD_BBOX.maxLat - AHMEDABAD_BBOX.minLat);
    const score = Math.random() * 100;
    features.push({
      type: "Feature",
      geometry:   { type: "Point", coordinates: [lon, lat] },
      properties: { score },
    });
  }
  return { type: "FeatureCollection", features };
}

export default function IndiaMap() {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false); // true once map "load" fires

  const { activeLayers, overlays, weights, satelliteView, useCase, setPopup, addToast } = useStore();

  // ── Safe source data setter (guard: source must exist) ───────────────────
  function setSourceData(map, sourceId, data) {
    try {
      const src = map.getSource(sourceId);
      if (src) src.setData(data);
    } catch (e) {
      console.warn(`setSourceData(${sourceId}) failed:`, e);
    }
  }

  // ── Add/remove layers based on state ─────────────────────────────────────
  // IMPORTANT: only call when map.isStyleLoaded() === true
  function syncLayers(map) {
    // ── Heatmap ──────────────────────────────────────────────────────────────
    if (overlays.heatmap) {
      if (!map.getLayer("heatmap")) {
        map.addLayer({
          id:   "heatmap",
          type: "heatmap",
          source: "points",
          paint: {
            "heatmap-weight":   ["interpolate", ["linear"], ["get", "score"], 0, 0, 100, 1],
            "heatmap-radius":   ["interpolate", ["linear"], ["zoom"], 8, 15, 14, 40],
            "heatmap-opacity":  ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 0.85],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0,   "rgba(0,0,255,0)",
              0.2, "rgba(0,128,255,0.5)",
              0.4, "rgba(0,255,255,0.6)",
              0.6, "rgba(255,255,0,0.8)",
              0.8, "rgba(255,128,0,0.9)",
              1,   "rgba(255,0,0,1)",
            ],
          },
        });
      }
    } else {
      if (map.getLayer("heatmap")) map.removeLayer("heatmap");
    }

    // ── Clusters ─────────────────────────────────────────────────────────────
    if (overlays.clusters) {
      if (!map.getLayer("clusters-fill")) {
        map.addLayer({
          id:     "clusters-fill",
          type:   "fill",
          source: "clusters",
          paint:  { "fill-color": "#FF6B6B", "fill-opacity": 0.15 },
        });
      }
      if (!map.getLayer("clusters-line")) {
        map.addLayer({
          id:     "clusters-line",
          type:   "line",
          source: "clusters",
          paint:  { "line-color": "#FF6B6B", "line-width": 2 },
        });
      }
    } else {
      if (map.getLayer("clusters-fill")) map.removeLayer("clusters-fill");
      if (map.getLayer("clusters-line")) map.removeLayer("clusters-line");
    }

    // ── Hotspots ─────────────────────────────────────────────────────────────
    if (overlays.hotspots) {
      if (!map.getLayer("hotspots")) {
        map.addLayer({
          id:     "hotspots",
          type:   "circle",
          source: "hotspots",
          paint:  {
            "circle-radius":       10,
            "circle-color":        "#FFD700",
            "circle-stroke-color": "#000000",
            "circle-stroke-width": 2,
            "circle-opacity":      0.85,
          },
        });
      }
    } else {
      if (map.getLayer("hotspots")) map.removeLayer("hotspots");
    }

    // ── Isochrones ────────────────────────────────────────────────────────────
    if (overlays.isochrones) {
      if (!map.getLayer("isochrones-fill")) {
        map.addLayer({
          id:     "isochrones-fill",
          type:   "fill",
          source: "isochrones",
          paint:  {
            "fill-color": [
              "interpolate", ["linear"], ["get", "minutes"],
              10, "#14B8A6",
              20, "#3B82F6",
              30, "#8B5CF6",
            ],
            "fill-opacity": 0.2,
          },
        });
      }
      if (!map.getLayer("isochrones-line")) {
        map.addLayer({
          id:     "isochrones-line",
          type:   "line",
          source: "isochrones",
          paint:  {
            "line-color": [
              "interpolate", ["linear"], ["get", "minutes"],
              10, "#14B8A6",
              20, "#3B82F6",
              30, "#8B5CF6",
            ],
            "line-width": 1.5,
          },
        });
      }
    } else {
      if (map.getLayer("isochrones-fill")) map.removeLayer("isochrones-fill");
      if (map.getLayer("isochrones-line")) map.removeLayer("isochrones-line");
    }
  }

  // ── Fetch and update overlay data from real APIs ──────────────────────────
  async function refreshOverlayData(map) {
    if (!map || !map.isStyleLoaded()) return;

    if (overlays.clusters) {
      const data = await fetchClusters();
      if (data.__fallback) addToast({ title: "Clusters", message: "Using fallback cluster data." });
      setSourceData(map, "clusters", data);
    } else {
      setSourceData(map, "clusters", EMPTY_FC);
    }

    if (overlays.hotspots) {
      const data = await fetchHotspots();
      if (data.__fallback) addToast({ title: "Hotspots", message: "Using fallback hotspot data." });
      setSourceData(map, "hotspots", data);
    } else {
      setSourceData(map, "hotspots", EMPTY_FC);
    }

    if (overlays.isochrones) {
      const center = map.getCenter();
      // Only fetch isochrone if center is inside Ahmedabad
      if (isInsideAhmedabad(center.lat, center.lng)) {
        const isoArray = await fetchIsochrones(center.lat, center.lng, "car", [10, 20, 30]);
        // Backend: [{ minutes, mode, geometry }]  geometry is a GeoJSON geometry object
        const features = (Array.isArray(isoArray) ? isoArray : []).flatMap((iso) => {
          const geom = iso.geometry;
          return geom ? [{ type: "Feature", geometry: geom, properties: { minutes: iso.minutes } }] : [];
        });
        setSourceData(map, "isochrones", { type: "FeatureCollection", features });
      }
    } else {
      setSourceData(map, "isochrones", EMPTY_FC);
    }
  }

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: satelliteView
        ? "https://tiles.stadiamaps.com/styles/alidade_satellite.json"
        : "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
      center:   AHMEDABAD_CENTER,
      zoom:     AHMEDABAD_ZOOM,
      maxBounds: MAX_BOUNDS,
      attributionControl: true,
      preserveDrawingBuffer: true,
    });

    mapRef.current = map;

    // ── load: add all sources then sync layers ────────────────────────────
    map.on("load", () => {
      loadedRef.current = true;

      // Add sources with empty data; we'll fill them via setData
      map.addSource("points",    { type: "geojson", data: generatePoints(300) });
      map.addSource("clusters",  { type: "geojson", data: EMPTY_FC });
      map.addSource("hotspots",  { type: "geojson", data: EMPTY_FC });
      map.addSource("isochrones",{ type: "geojson", data: EMPTY_FC });

      syncLayers(map);
      refreshOverlayData(map);
    });

    // After a style change (satellite toggle), re-add sources + layers
    map.on("style.load", () => {
      if (!loadedRef.current) return; // first load handled by "load" event

      MANAGED_SOURCES.forEach((id) => {
        if (!map.getSource(id)) {
          const initData = id === "points" ? generatePoints(300) : EMPTY_FC;
          map.addSource(id, { type: "geojson", data: initData });
        }
      });

      syncLayers(map);
      refreshOverlayData(map);
    });

    // ── Click handler ─────────────────────────────────────────────────────
    map.on("click", async (e) => {
      const lat = e.lngLat.lat;
      const lon = e.lngLat.lng;

      // Enforce Ahmedabad-only
      if (!isInsideAhmedabad(lat, lon)) {
        addToast({ title: "Out of bounds", message: "Please click within Ahmedabad." });
        return;
      }

      try {
        const scoreData = await scoreLocation(lat, lon, weights, useCase);
        if (!scoreData) return; // null = outside bbox (already guarded above)

        if (scoreData.__fallback) {
          addToast({ title: "Server fallback", message: "Scoring API unavailable; showing fallback values." });
        }

        setPopup({
          x: e.point.x,
          y: e.point.y,
          lat,
          lng: lon,
          score: scoreData,
        });
      } catch (err) {
        console.error("Scoring failed:", err);
        addToast({ title: "Score error", message: "Unable to retrieve score from the server." });
      }
    });

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync layers when overlays / activeLayers change ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncLayers(map);
  }, [activeLayers, overlays]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch real overlay data when overlays change ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    refreshOverlayData(map);
  }, [overlays]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Satellite style swap ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(
      satelliteView
        ? "https://tiles.stadiamaps.com/styles/alidade_satellite.json"
        : "https://tiles.stadiamaps.com/styles/alidade_smooth.json"
    );
  }, [satelliteView]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ background: "#FFFFFF", pointerEvents: "auto" }}
    >
      <style>{`
        .maplibregl-canvas-container { position: absolute; inset: 0; width: 100%; height: 100%; }
        .maplibregl-canvas { width: 100% !important; height: 100% !important; }
        .maplibregl-ctrl-logo, .maplibregl-ctrl-bottom-right { display: none !important; }
      `}</style>
    </div>
  );
}