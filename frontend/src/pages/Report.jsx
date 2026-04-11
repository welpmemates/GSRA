import Navbar from "../components/layout/Navbar";
import useStore from "../store/useStore";
import { exportResults } from "../api/api";

const BREAKDOWN_KEYS = [
  { key: "demographics", name: "Demographics" },
  { key: "transport",    name: "Roads & Transit" },
  { key: "competitors",  name: "Competitors" },
  { key: "zoning",       name: "Zoning" },
  { key: "environment",  name: "Environment" },
];

export default function Report() {
  const { lastScore, lastSite, useCase } = useStore();

  // If no site has been scored yet, prompt the user
  if (!lastScore || !lastSite) {
    return (
      <div className="relative min-h-screen bg-white" style={{ color: "#000000" }}>
        <Navbar />
        <div
          className="flex flex-col items-center justify-center pt-20"
          style={{ minHeight: 400, color: "#888", fontSize: 15 }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
          <div>No site analysed yet.</div>
          <div style={{ fontSize: 13, marginTop: 8, color: "#aaa" }}>
            Click a location on the map and press &ldquo;Deep analyze →&rdquo;.
          </div>
        </div>
      </div>
    );
  }

  const { lat, lng } = lastSite;
  const metrics = lastScore.raw_metrics   ?? {};
  const constraints = lastScore.constraints ?? {};

  // Build breakdown rows from normalized score (0-100 per dimension)
  const breakdownRows = BREAKDOWN_KEYS.map(({ key, name }) => ({
    name,
    value: lastScore[key] ?? 0,
  }));

  // Export current site via backend /api/export
  const handleExportCSV = async () => {
    try {
      const blob = await exportResults([
        {
          lat,
          lon: lng,
          use_case: useCase === "EV Charging" ? "ev_charging"
                   : useCase === "Warehouse"   ? "warehouse"
                   : useCase === "Telecom"     ? "telecom"
                   : "retail",
          weights: lastScore.weights_applied ?? undefined,
        },
      ]);
      const url = URL.createObjectURL(new Blob([blob], { type: "text/csv" }));
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `gsra_report_${lat.toFixed(4)}_${lng.toFixed(4)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  return (
    <div className="relative min-h-screen bg-white" style={{ color: "#000000" }}>
      <Navbar />

      <div className="pt-20 px-8 pb-16 max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-10 pt-2">
          <p style={{ fontSize: 14, color: "#555555" }}>
            {Number(lat).toFixed(4)}°N · {Number(lng).toFixed(4)}°E · {useCase} ·{" "}
            Generated {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Score card */}
        <div
          style={{
            background: "#FFFFFF",
            border: "2px solid #E5E5E5",
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div style={{ fontSize: 13, color: "#888888", marginBottom: 4 }}>Overall score</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#000000" }}>
                {lastScore.total ?? lastScore.final_score ?? 0}
              </div>
            </div>
            <button
              onClick={handleExportCSV}
              style={{
                padding: "10px 16px",
                background: "#000000",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#333333")}
              onMouseLeave={(e) => (e.target.style.background = "#000000")}
            >
              Download CSV
            </button>
          </div>
        </div>

        {/* Score breakdown */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#000000", marginBottom: 12 }}>
            Score breakdown
          </h2>
          <div style={{ borderTop: "1px solid #E5E5E5", paddingTop: 12 }}>
            {breakdownRows.map((item, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#14B8A6" }}>
                    {item.value}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "#E5E5E5",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${item.value}%`,
                      background: "#14B8A6",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raw metrics */}
        {Object.keys(metrics).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#000000", marginBottom: 12 }}>
              Key metrics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Population proxy (5km)",   value: metrics.pop_5km             },
                { label: "Roads within 1km",          value: metrics.road_count_1km      },
                { label: "Competitors within 2km",    value: metrics.competitor_count_2km },
                { label: "Flood risk",                value: typeof metrics.flood_risk === "number"
                                                               ? (metrics.flood_risk * 100).toFixed(1) + "%"
                                                               : metrics.flood_risk },
                { label: "Commercial land %",         value: typeof metrics.commercial_land_pct === "number"
                                                               ? metrics.commercial_land_pct.toFixed(1) + "%"
                                                               : metrics.commercial_land_pct },
                { label: "Restricted zone",           value: typeof metrics.in_restricted_zone === "boolean"
                                                               ? (metrics.in_restricted_zone ? "Yes" : "No")
                                                               : metrics.in_restricted_zone },
              ]
                .filter(({ value }) => value !== undefined && value !== null)
                .map((metric, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#F8F8F8",
                      border: "1px solid #E5E5E5",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#888888", marginBottom: 4 }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#000000" }}>
                      {typeof metric.value === "number" ? metric.value.toLocaleString() : String(metric.value ?? "—")}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Constraints */}
        {Object.keys(constraints).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#000000", marginBottom: 12 }}>
              Constraints
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(constraints).map(([key, val]) => {
                const passed = typeof val === "object" ? val.passed : val;
                const label  = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div
                    key={key}
                    style={{
                      background: "#F8F8F8",
                      border: `1px solid ${passed ? "#14B8A6" : "#EF4444"}`,
                      borderRadius: 8,
                      padding: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{passed ? "✓" : "✗"}</span>
                    <div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{label}</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: passed ? "#14B8A6" : "#EF4444",
                        }}
                      >
                        {passed ? "PASS" : "FAIL"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}