import { useState } from "react";
import Navbar from "../components/layout/Navbar";
import Toggle from "../components/ui/Toggle";
import useStore from "../store/useStore";
import { WEIGHT_PROFILES } from "../data/mockData";

const LAYER_META = [
  { key: "demographics", label: "Demographics",   desc: "Population density, income, age distribution" },
  { key: "transport",    label: "Roads & transit", desc: "Highway proximity, road density, OSRM routing" },
  { key: "competitors",  label: "Competitors",     desc: "POI proximity, market saturation, Goldilocks curve" },
  { key: "zoning",       label: "Zoning",          desc: "Commercial / industrial / residential classification" },
  { key: "environment",  label: "Environment",     desc: "FEMA flood zones, air quality index" },
];

const DEFAULT_WEIGHTS = { demographics: 0.30, transport: 0.25, competitors: 0.20, zoning: 0.15, environment: 0.10 };

export default function Settings() {
  const { weights, setWeights, useCase } = useStore();
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh]     = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileWeights, setNewProfileWeights] = useState({
    demographics: 0.2, transport: 0.2, competitors: 0.2, zoning: 0.2, environment: 0.2,
  });

  function updateWeight(key, val) {
    const newWeights = { ...weights, [key]: val };
    const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (total > 0) Object.keys(newWeights).forEach(k => { newWeights[k] = newWeights[k] / total; });
    setWeights(newWeights);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Reset weights to the current use-case preset, or to defaults
  function handleReset() {
    const preset = WEIGHT_PROFILES[useCase] ?? DEFAULT_WEIGHTS;
    setWeights({ ...preset });
  }

  function createNewProfile() {
    if (!newProfileName.trim()) return;
    setWeights({ ...newProfileWeights });
    setShowNewProfile(false);
    setNewProfileName("");
    setNewProfileWeights({ demographics: 0.2, transport: 0.2, competitors: 0.2, zoning: 0.2, environment: 0.2 });
  }

  function updateNewProfileWeight(key, val) {
    const newWeights = { ...newProfileWeights, [key]: val };
    const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (total > 0) Object.keys(newWeights).forEach(k => { newWeights[k] = newWeights[k] / total; });
    setNewProfileWeights(newWeights);
  }

  const total    = Object.values(weights).reduce((a, b) => a + b, 0);
  const balanced = Math.abs(total - 1) < 0.005;

  return (
    <div className="relative min-h-screen bg-white" style={{ color: "#000000" }}>
      <Navbar />

      <div className="pt-20 px-8 pb-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mt-4 mb-10">
          <p style={{ fontSize: 14, color: "#555555", textAlign: "center" }}>
            Configure scoring weights, data layers, and display preferences
          </p>
        </div>

        {/* Create new profile */}
        <section className="mb-8">
          <div className="overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8 }}>
            <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: "1px solid #E5E5E5" }}>
              <div style={{ fontSize: 10, color: "#777777", fontWeight: 600 }}>Create custom profile</div>
              <button
                onClick={() => setShowNewProfile(!showNewProfile)}
                className="rounded-lg px-3 py-1 cursor-pointer"
                style={{
                  background: showNewProfile ? "#F0F0F0" : "#14B8A6",
                  border: "1px solid #E5E5E5",
                  color: showNewProfile ? "#000000" : "#FFFFFF",
                  fontSize: 12, fontWeight: 600, transition: "all 0.15s ease",
                }}
              >
                {showNewProfile ? "Cancel" : "+ New profile"}
              </button>
            </div>

            {showNewProfile && (
              <div className="px-6 py-6">
                <div className="mb-4">
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#000000", display: "block", marginBottom: 6 }}>
                    Profile name
                  </label>
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="e.g., Retail Focus, Urban Planning"
                    className="w-full rounded-lg px-3 py-2"
                    style={{ border: "1px solid #E5E5E5", fontSize: 13, color: "#000000", background: "#FFFFFF" }}
                  />
                </div>

                <div className="mb-4">
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#000000", marginBottom: 6 }}>
                    Weight distribution (auto-normalized to 100%)
                  </div>
                  {LAYER_META.map(({ key, label }) => (
                    <div key={key} className="mb-3 last:mb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span style={{ fontSize: 12, color: "#666666" }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#14B8A6" }}>
                          {(newProfileWeights[key] * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={newProfileWeights[key]}
                        onChange={(e) => updateNewProfileWeight(key, parseFloat(e.target.value))}
                        className="w-full cursor-pointer"
                        style={{ accentColor: "#14B8A6", height: 4 }}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={createNewProfile}
                  disabled={!newProfileName.trim()}
                  className="w-full rounded-lg py-2 cursor-pointer"
                  style={{
                    background: !newProfileName.trim() ? "#F0F0F0" : "#14B8A6",
                    border: "1px solid #E5E5E5",
                    color: !newProfileName.trim() ? "#999999" : "#FFFFFF",
                    fontSize: 13, fontWeight: 600, transition: "all 0.15s ease",
                  }}
                >
                  Create profile
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Layer weights */}
        <section className="mb-8">
          <div className="overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8 }}>
            <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: "1px solid #E5E5E5" }}>
              <div style={{ fontSize: 10, color: "#777777", fontWeight: 600 }}>
                Layer weights (auto-normalized to 100%)
              </div>
              <div className="gs-mono" style={{ fontSize: 11, color: balanced ? "#14B8A6" : "#EF4444", fontWeight: 600 }}>
                Total: {(total * 100).toFixed(0)}%
              </div>
            </div>

            <div className="px-6 py-5">
              {LAYER_META.map(({ key, label, desc }) => (
                <div key={key} className="mb-6 last:mb-0">
                  <div className="flex justify-between items-start mb-2">
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#000000", display: "block", marginBottom: 3 }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 11, color: "#888888", display: "block" }}>{desc}</span>
                    </div>
                    <span className="gs-mono" style={{ fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: "right", color: "#14B8A6" }}>
                      {(weights[key] * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={weights[key]}
                    onChange={(e) => updateWeight(key, parseFloat(e.target.value))}
                    className="w-full cursor-pointer"
                    style={{ accentColor: "#14B8A6", height: 4 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-10">
          <div className="overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8 }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #E5E5E5" }}>
              <div style={{ fontSize: 10, color: "#777777", fontWeight: 600 }}>Preferences</div>
            </div>

            {[
              { label: "Cluster notifications", desc: "Alert when a new hot zone is detected",   on: notifications, toggle: () => setNotifications(v => !v) },
              { label: "Auto-refresh heatmap",  desc: "Recompute scores every 30 minutes",        on: autoRefresh,   toggle: () => setAutoRefresh(v => !v)   },
            ].map(({ label, desc, on, toggle }) => (
              <div
                key={label}
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: label !== "Auto-refresh heatmap" ? "1px solid #E5E5E5" : "none" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#000000", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#888888" }}>{desc}</div>
                </div>
                <div style={{ marginLeft: 20 }}>
                  <Toggle on={on} onChange={toggle} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end gap-4">
          <button
            style={{
              padding: "10px 20px", borderRadius: 6, border: "1px solid #E5E5E5",
              background: "#F8F8F8", color: "#666666", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
            }}
            onClick={handleReset}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EEEEEE")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F8F8F8")}
          >
            Reset to default
          </button>
          <button
            style={{
              padding: "10px 24px", borderRadius: 6, border: "none",
              background: "#000000", color: "#FFFFFF", fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s",
            }}
            onClick={handleSave}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333333")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#000000")}
          >
            {saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}