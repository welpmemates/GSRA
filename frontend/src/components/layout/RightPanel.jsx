import useStore from "../../store/useStore";
import ScoreRing from "../scoring/ScoreRing";
import ScoreBreakdown from "../scoring/ScoreBreakdown";
import ZoneCard from "../scoring/ZoneCard";
import StatCard from "../ui/StatCard";
import Badge from "../ui/Badge";
import { HOT_ZONES, CITY_STATS } from "../../data/mockData";

// Static city-level breakdown (shown when no site has been scored yet)
const CITY_BREAKDOWN = {
  demographics: 82,
  transport:    91,
  competitors:  58,
  zoning:       88,
  environment:  45,
};

export default function RightPanel() {
  const { useCase, lastScore, lastSite } = useStore();

  // If a site has been scored, show that; otherwise show city overview
  const isLive      = !!lastScore;
  const displayScore = isLive ? lastScore.total : 73;
  const displayBreakdown = isLive
    ? {
        demographics: lastScore.demographics,
        transport:    lastScore.transport,
        competitors:  lastScore.competitors,
        zoning:       lastScore.zoning,
        environment:  lastScore.environment,
      }
    : CITY_BREAKDOWN;

  const scoreLabel =
    displayScore >= 80 ? "Excellent zone" :
    displayScore >= 65 ? "Good zone" :
    displayScore >= 50 ? "Average zone" :
    displayScore >= 30 ? "Poor zone" : "Below threshold";

  return (
    <aside
      className="absolute top-20 right-4 bottom-4 z-[180] flex flex-col overflow-y-auto"
      style={{
        width:          320,
        background:     "#FFFFFF",
        border:         "1px solid #E5E5E5",
        borderRadius:   8,
        backdropFilter: "blur(12px)",
        boxShadow:      "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex-shrink-0 p-5" style={{ borderBottom: "1px solid #E5E5E5" }}>
        <div style={{ fontSize: 10, color: "#888888", fontWeight: 600, marginBottom: 12 }}>
          {useCase} Intelligence
          {isLive && (
            <span style={{ marginLeft: 8, color: "#14B8A6" }}>
              · {Number(lastSite?.lat).toFixed(3)}°N {Number(lastSite?.lng).toFixed(3)}°E
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ScoreRing score={displayScore} size={80} sw={6} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#000000", marginBottom: 4 }}>
              {scoreLabel}
            </div>
            <div style={{ fontSize: 12, color: "#666666", marginBottom: 10 }}>
              {isLive ? "Live site score" : "4 active hotspots ↑"}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Badge>4 hot</Badge>
              <Badge>2 warm</Badge>
              <Badge>1 cold</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: "1px solid #E5E5E5" }}>
        <div style={{ fontSize: 10, color: "#888888", fontWeight: 600, marginBottom: 10 }}>
          {isLive ? "Site breakdown" : "Layer breakdown"}
        </div>
        <ScoreBreakdown breakdown={displayBreakdown} />

        {/* Raw metrics display when live */}
        {isLive && lastScore.raw_metrics && Object.keys(lastScore.raw_metrics).length > 0 && (
          <div style={{ marginTop: 12, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: "#555", marginBottom: 6 }}>Raw metrics</div>
            {[
              ["Population proxy (5km)", lastScore.raw_metrics.pop_5km],
              ["Roads within 1km",       lastScore.raw_metrics.road_count_1km],
              ["Competitors within 2km", lastScore.raw_metrics.competitor_count_2km],
              ["Flood risk",             lastScore.raw_metrics.flood_risk],
              ["Commercial land %",      lastScore.raw_metrics.commercial_land_pct],
              ["Restricted zone",        lastScore.raw_metrics.in_restricted_zone],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-0.5" style={{ color: "#666" }}>
                <span>{label}</span>
                <span style={{ fontWeight: 600, color: "#333" }}>
                  {typeof val === "boolean"
                    ? (val ? "Yes" : "No")
                    : typeof val === "number"
                      ? val.toFixed(2)
                      : String(val ?? "—")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div style={{ fontSize: 10, color: "#888888", fontWeight: 600, marginBottom: 10 }}>
          Detected zones
        </div>
        {HOT_ZONES.map((zone) => (
          <ZoneCard key={zone.id} zone={zone} compact />
        ))}
      </div>

      <div className="flex-shrink-0 grid grid-cols-3 gap-2 p-4" style={{ borderTop: "1px solid #E5E5E5" }}>
        <StatCard value={CITY_STATS.totalHexagons} label="hexagons" />
        <StatCard value={CITY_STATS.clusters}       label="clusters" />
        <StatCard value={CITY_STATS.giHotspots}     label="Gi* 99%" />
      </div>
    </aside>
  );
}