import { scoreColor, scoreLabel } from "../../data/mockData";
import useStore from "../../store/useStore";

/**
 * ZoneCard
 * @param {object}  zone     zone data object
 * @param {boolean} compact  smaller version for sidebar
 */
export default function ZoneCard({ zone, compact = true }) {
  const { selectedZoneId, setSelectedZoneId } = useStore();
  const isSelected = selectedZoneId === zone.id;
  const color = scoreColor(zone.score);

  return (
    <div
      className="zone-row p-3 mb-2 animate-fade-in cursor-pointer"
      style={{
        borderColor: isSelected ? "#E5E5E5" : "#E5E5E5",
        background:  isSelected ? "#F5F5F5" : "#FFFFFF",
        border: isSelected ? "2px solid #000000" : "1px solid #E5E5E5",
      }}
      onClick={() => setSelectedZoneId(isSelected ? null : zone.id)}
    >
      {/* Header row */}
      <div className="flex justify-between items-start mb-2">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>
            Zone {String.fromCharCode(64 + zone.rank)}
          </div>
          <div className="mt-1" style={{ fontSize: 11, color: "#666666" }}>
            {zone.name}
            {compact
              ? ` · ${zone.hexCount} hex · ${zone.area} km²`
              : ""}
          </div>
        </div>
        <span
          className="gs-mono font-bold leading-none"
          style={{ fontSize: compact ? 18 : 24, color: isSelected ? "#14B8A6" : "#000000" }}
        >
          {zone.score}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full"
        style={{ height: 3, background: "#E5E5E5" }}
      >
        <div
          className="rounded-full"
          style={{
            height:     "100%",
            width:      `${zone.score}%`,
            background: color,
            transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>

      {/* Expanded detail */}
      {!compact && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Population",  zone.population],
            ["Income avg",  zone.avgIncome],
            ["Gi* conf.",   zone.giConfidence],
          ].map(([l, v]) => (
            <div
              key={l}
              className="text-center rounded-lg py-2"
              style={{ background: "#F8F8F8", border: "1px solid #E5E5E5" }}
            >
              <div className="gs-mono" style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>{v}</div>
              <div className="mt-1" style={{ fontSize: 10, color: "#777777", fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
