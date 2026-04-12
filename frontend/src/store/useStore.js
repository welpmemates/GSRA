import { create } from "zustand";
import { WEIGHT_PROFILES } from "../data/mockData";
import { optimizeWeights, fromBackendWeights, scoreLocation } from "../api/api";

const useStore = create((set, get) => ({
  // ── Active page ────────────────────────────────────────────────
  page: "dashboard",
  setPage: (page) => set({ page }),

  // ── Weights for scoring ─────────────────────────────────────────
  // Keys: demographics, transport, competitors, zoning, environment
  // These are mapped to backend keys in api.js via toBackendWeights()
  weights: { demographics: 0.30, transport: 0.25, competitors: 0.20, zoning: 0.15, environment: 0.10 },
  setWeights: (weights) => set({ weights }),

  // ── Active data layers ─────────────────────────────────────────
  activeLayers: ["demo"],
  toggleLayer: (id) =>
    set((s) => ({
      activeLayers: s.activeLayers.includes(id)
        ? s.activeLayers.filter((l) => l !== id)
        : [...s.activeLayers, id],
    })),

  // ── Overlays ───────────────────────────────────────────────────
  overlays: { heatmap: true, clusters: false, hotspots: false, isochrones: false },
  toggleOverlay: (key) =>
    set((s) => ({ overlays: { ...s.overlays, [key]: !s.overlays[key] } })),

  // ── Use case selection ─────────────────────────────────────────
  useCase: "Retail",
  setUseCase: (useCase) => {
    const weights = WEIGHT_PROFILES[useCase] ?? get().weights;
    set({ useCase, weights });
  },

  // ── Toast notifications ───────────────────────────────────────
  toasts: [],
  addToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { id: `${Date.now()}-${Math.random()}`, ...toast }] })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),

  // ── Sidebar open/collapsed ─────────────────────────────────────
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // ── Map popup ──────────────────────────────────────────────────
  popup: null,
  setPopup: (popup) => {
    set({ popup });
    // Also store as lastScore so RightPanel can display it
    if (popup?.score) {
      set({ lastScore: popup.score, lastSite: { lat: popup.lat, lng: popup.lng } });
    }
  },
  closePopup: () => set({ popup: null }),

  // ── Last scored site (for RightPanel live display) ────────────
  lastScore: null,
  lastSite:  null,

  // ── Compared sites (up to 3) ───────────────────────────────────
  comparedSites: [],
  addCompare: (site) =>
    set((s) => {
      if (s.comparedSites.find((x) => x.id === site.id)) return s;
      if (s.comparedSites.length >= 3) return s;
      return { comparedSites: [...s.comparedSites, site] };
    }),
  removeCompare: (id) =>
    set((s) => ({ comparedSites: s.comparedSites.filter((x) => x.id !== id) })),
  clearCompare: () => set({ comparedSites: [] }),

  // ── AI bar ─────────────────────────────────────────────────────
  aiQuery:  "",
  aiReply:  "",
  aiActive: false,
  setAiQuery:  (aiQuery)  => set({ aiQuery }),
  setAiReply:  (aiReply)  => set({ aiReply }),
  setAiActive: (aiActive) => set({ aiActive }),
  clearAi: () => set({ aiQuery: "", aiReply: "", aiActive: false }),

  // ── Selected zone (right panel highlight) ─────────────────────
  selectedZoneId: null,
  setSelectedZoneId: (id) => set({ selectedZoneId: id }),

  // ── Map satellite view ─────────────────────────────────────────
  satelliteView: false,
  toggleSatelliteView: () => set((s) => ({ satelliteView: !s.satelliteView })),

  // ── RL-inspired weight optimizer ───────────────────────────────
  // State  = current location + spatial metrics
  // Action = weight vector selection
  // Reward = final score (0–300 from backend, normalised 0–100 in frontend)
  isOptimizing: false,
  optimizeWeightsForLocation: async () => {
    const { useCase, lastSite, weights, setWeights, addToast } = get();

    if (!lastSite) {
      addToast({ title: "No site selected", message: "Click a location on the map first." });
      return;
    }

    set({ isOptimizing: true });
    try {
      const res = await optimizeWeights(lastSite.lat, lastSite.lng, useCase);
      const newWeights = fromBackendWeights(res.optimal_weights);
      setWeights(newWeights);

      // Re-run scoring with the freshly optimised weights so panel updates immediately
      const newScore = await scoreLocation(lastSite.lat, lastSite.lng, newWeights, useCase);
      if (newScore) {
        set({ lastScore: newScore });
        // Also patch the popup score if one is open
        const popup = get().popup;
        if (popup) set({ popup: { ...popup, score: newScore } });
      }

      addToast({
        title: "Weights optimised ✓",
        message: `Best score: ${Math.round(res.best_score / 3)}/100. Sliders updated.`,
      });
    } catch (e) {
      console.error("Optimization failed", e);
      addToast({ title: "Optimise failed", message: "Could not reach the optimizer. Try again." });
    } finally {
      set({ isOptimizing: false });
    }
  },

  // ── Dropped pin (click marker on map) ─────────────────────────
  droppedPin: null,   // { lat, lon } | null
  setDroppedPin: (pin) => set({ droppedPin: pin }),
  clearDroppedPin: () => set({ droppedPin: null }),
}));

export default useStore;