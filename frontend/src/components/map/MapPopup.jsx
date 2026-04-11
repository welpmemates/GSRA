import { useEffect, useRef } from "react";
import useStore from "../../store/useStore";
import ScoreRing from "../../components/scoring/ScoreRing";

// Display labels for the five scoring dimensions
const LAYER_SHORT = ["Demo", "Roads", "Comp", "Zone", "Env"];
// These match the normalized keys from normalizeScoreResponse() in api.js
const LAYER_KEYS  = ["demographics", "transport", "competitors", "zoning", "environment"];

export default function MapPopup() {
  const { popup, closePopup, setPage, addCompare } = useStore();
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) closePopup();
    }
    if (popup) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popup, closePopup]);

  if (!popup) return null;

  const { score, lat, lng } = popup;
  // score.total is set by normalizeScoreResponse (0-100 clamped)
  const totalScore = Math.round(score?.total ?? 0);
  const POPUP_W = 256;

  return (
    <div
      ref={ref}
      className="absolute z-[300] overflow-hidden animate-slide-up"
      style={{
        left:       "50%",
        top:        88,
        transform:  "translateX(-50%)",
        width:      POPUP_W,
        background: "#FFFFFF",
        border:     "2px solid #E5E5E5",
        borderRadius: 8,
        boxShadow:  "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="font-semibold" style={{ fontSize: 13, color: "#000000" }}>
              Site analysis
            </div>
            <div className="mt-1" style={{ fontSize: 11, color: "#666666" }}>
              {Number(lat).toFixed(4)}°N · {Number(lng).toFixed(4)}°E
            </div>
          </div>
          <button
            onClick={closePopup}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid #E5E5E5", background: "#F8F8F8",
              color: "#666666", fontSize: 14, transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background   = "#F0F0F0";
              e.currentTarget.style.borderColor  = "#14B8A6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background   = "#F8F8F8";
              e.currentTarget.style.borderColor  = "#E5E5E5";
            }}
          >
            ✕
          </button>
        </div>

        {/* Score ring */}
        <div className="flex items-center gap-4 mb-4">
          <ScoreRing score={totalScore} size={72} sw={6} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#000000" }}>
              {totalScore}
            </div>
            <div style={{ fontSize: 11, color: "#666666" }}>
              Overall score
            </div>
            {score?.__fallback && (
              <div style={{ fontSize: 10, color: "#FF8C00", marginTop: 2 }}>
                ⚠ Fallback data
              </div>
            )}
          </div>
        </div>

        {/* Sub-score breakdown bars */}
        <div className="mb-4">
          <div style={{ fontSize: 12, fontWeight: 600, color: "#000000", marginBottom: 8 }}>
            Score breakdown
          </div>
          {LAYER_KEYS.map((key, i) => {
            const val = score?.[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 11, width: 40, color: "#666666" }}>
                  {LAYER_SHORT[i]}
                </span>
                <div className="flex-1 rounded-full" style={{ height: 4, background: "#F0F0F0" }}>
                  <div
                    className="rounded-full"
                    style={{ height: "100%", width: `${val}%`, background: "#14B8A6" }}
                  />
                </div>
                <span style={{ fontSize: 11, width: 24, textAlign: "right", color: "#000000", fontWeight: 600 }}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>

        {/* Raw metrics hint */}
        {score?.raw_metrics && Object.keys(score.raw_metrics).length > 0 && (
          <div className="mb-4" style={{ fontSize: 10, color: "#888", borderTop: "1px solid #F0F0F0", paddingTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Raw metrics</div>
            {Object.entries(score.raw_metrics).slice(0, 4).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k.replace(/_/g, " ")}</span>
                <span style={{ fontWeight: 600, color: "#333" }}>
                  {typeof v === "boolean" ? (v ? "Yes" : "No") : Number(v).toFixed?.(2) ?? v}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              addCompare({ id: `${lat}-${lng}`, label: "Site", score, lat, lng });
              setPage("compare");
              closePopup();
            }}
            className="flex-1 rounded-lg cursor-pointer"
            style={{
              padding: "10px", background: "#F8F8F8", border: "1px solid #E5E5E5",
              color: "#000000", fontSize: 12, fontWeight: 600, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background  = "#F0F0F0";
              e.currentTarget.style.borderColor = "#14B8A6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background  = "#F8F8F8";
              e.currentTarget.style.borderColor = "#E5E5E5";
            }}
          >
            + Compare
          </button>
          <button
            onClick={() => { setPage("report"); closePopup(); }}
            className="flex-1 rounded-lg cursor-pointer font-semibold"
            style={{
              padding: "10px", background: "#14B8A6", border: "none",
              color: "#FFFFFF", fontSize: 12, fontWeight: 600, transition: "filter 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            Deep analyze →
          </button>
        </div>
      </div>
    </div>
  );
}