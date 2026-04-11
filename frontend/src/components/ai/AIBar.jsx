import { useRef } from "react";
import useStore from "../../store/useStore";
import { AI_SUGGESTIONS, USE_CASES } from "../../data/mockData";
import { startRlOptimize, getRlStatus } from "../../api/api";

const MOCK_REPLIES = {
  default:
    "Analyzing query — Found 3 optimal zones. Best match: North Corridor (score 87) — highway within 400 m, commercial zoning confirmed, low flood risk, 2.1 L population within 5 km radius.",
  ev:
    "EV Charging analysis — 2 prime locations near NH-48 with power infrastructure proximity. Zone A (score 91): highway 200 m, industrial zone, zero flood risk.",
  warehouse:
    "Warehouse scan — East GIDC corridor scores highest (82). Key factors: NH access 1.2 km, industrial zoning confirmed, rail proximity 3 km, 45,000 sqm available land.",
};

function getMockReply(q) {
  const lower = q.toLowerCase();
  if (lower.includes("ev") || lower.includes("charging")) return MOCK_REPLIES.ev;
  if (lower.includes("warehouse")) return MOCK_REPLIES.warehouse;
  return MOCK_REPLIES.default;
}

export default function AIBar() {
  const {
    aiQuery,
    aiReply,
    aiActive,
    setAiQuery,
    setAiReply,
    setAiActive,
    clearAi,
    useCase,
    setUseCase,
    satelliteView,
    toggleSatelliteView,
    addToast,
  } = useStore();
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  function handleKey(e) {
    if (e.key === "Enter" && aiQuery.trim()) {
      setAiReply(getMockReply(aiQuery));
    }
    if (e.key === "Escape") {
      clearAi();
      inputRef.current?.blur();
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setAiActive(false);
      }
    }, 50);
  };

  const handleOptimize = async () => {
    const result = await startRlOptimize(5, 100);
    addToast({
      title: "RL optimization",
      message: result.message || "RL optimization started.",
    });

    if (result.task_id) {
      const status = await getRlStatus(result.task_id);
      addToast({
        title: "RL status",
        message: `Task ${result.task_id.slice(0, 8)} status: ${status.status}`,
      });
    }
  };

  const expanded = aiActive || !!aiReply;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-5 left-1/2 z-[200] overflow-hidden"
      style={{
        transform: "translateX(-50%)",
        width: expanded ? "min(100%, 700px)" : "min(100%, 520px)",
        background: "#FFFFFF",
        border: `1px solid ${expanded ? "rgba(20,184,166,0.3)" : "rgba(20,184,166,0.2)"}`,
        borderRadius: 8,
        backdropFilter: "blur(12px)",
        transition: "width 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.2s, box-shadow 0.2s",
        boxShadow: expanded
          ? "0 0 0 1px rgba(20,184,166,0.1), 0 8px 32px rgba(0,0,0,0.12)"
          : "0 4px 24px rgba(0,0,0,0.1)",
      }}
    >
      {aiReply && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid #E5E5E5" }}>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 16, height: 16, borderRadius: 3, background: "#14B8A6" }}
            >
              <span style={{ fontSize: 9, color: "#fff" }}>✦</span>
            </div>
            <span className="gs-label" style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>
              AI insight
            </span>
          </div>
          <p className="leading-relaxed m-0" style={{ fontSize: 13, color: "#000000", lineHeight: 1.5 }}>
            {aiReply}
          </p>
        </div>
      )}

      {aiActive && !aiQuery && !aiReply && (
        <div className="px-4 pt-3 pb-1" style={{ borderBottom: "1px solid #E5E5E5" }}>
          <div className="gs-label mb-2" style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>
            Try asking
          </div>
          <div className="flex flex-col gap-0.5">
            {AI_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setAiQuery(s);
                  inputRef.current?.focus();
                }}
                className="text-left rounded-lg px-2.5 py-1.5 cursor-pointer"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#666666",
                  fontSize: 12,
                  transition: "color 0.12s, background 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#14B8A6";
                  e.currentTarget.style.background = "#F5F5F5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#666666";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-3.5 py-2.5" style={{ width: expanded ? "min(100%, 700px)" : "min(100%, 520px)" }}>
        <button
          onClick={toggleSatelliteView}
          className="rounded-xl"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid #E5E5E5",
            background: "#FFFFFF",
            cursor: "pointer",
            color: "#000000",
            fontSize: 18,
            boxShadow: "0 2px 14px rgba(0,0,0,0.07)",
          }}
          title="Toggle satellite view"
        >
          {satelliteView ? "🌍" : "🛰️"}
        </button>

        <select
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          style={{
            minWidth: 150,
            borderRadius: 12,
            border: "1px solid #E5E5E5",
            padding: "0 10px",
            height: 44,
            color: "#000000",
            background: "#FFFFFF",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {USE_CASES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <input
          ref={inputRef}
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          onFocus={() => setAiActive(true)}
          onBlur={handleBlur}
          onKeyDown={handleKey}
          placeholder='Ask about locations...'
          style={{
            flex: 1,
            background: "transparent",
            border: "1px solid #E5E5E5",
            borderRadius: 12,
            padding: "10px 14px",
            outline: "none",
            color: "#000000",
            fontSize: 13,
            minWidth: 120,
          }}
        />

        <button
          onClick={handleOptimize}
          className="gs-btn-ghost"
          style={{ padding: "10px 16px", borderRadius: 12, background: "#F8F8F8", border: "1px solid #E5E5E5", cursor: "pointer", fontSize: 13 }}
        >
          Optimize
        </button>
      </div>
    </div>
  );
}
