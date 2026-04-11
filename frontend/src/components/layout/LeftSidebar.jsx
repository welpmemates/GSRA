import useStore from "../../store/useStore";
import Toggle from "../ui/Toggle";
import { LAYERS } from "../../data/mockData";

export default function LeftSidebar() {
  const {
    sidebarOpen, toggleSidebar,
    activeLayers, toggleLayer,
    overlays, toggleOverlay,
  } = useStore();

  const w = sidebarOpen ? 196 : 52;

  return (
    <aside
      className="absolute top-20 left-4 z-[180] flex flex-col overflow-hidden"
      style={{
        width:          w,
        transition:     "width 0.26s cubic-bezier(0.4,0,0.2,1)",
        background:     "#FFFFFF",
        border:         "1px solid #E5E5E5",
        borderRadius:   8,
        backdropFilter: "blur(12px)",
        paddingBottom:  8,
        boxShadow:      "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center w-full flex-shrink-0"
        style={{
          height:          38,
          justifyContent:  sidebarOpen ? "flex-end" : "center",
          padding:         sidebarOpen ? "0 14px" : 0,
          background:      "transparent",
          border:          "none",
          cursor:          "pointer",
          color:           "#999999",
          fontSize:        16,
          transition:      "all 0.26s",
        }}
      >
        <span
          style={{
            display:    "block",
            lineHeight: 1,
            transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)",
            transform:  sidebarOpen ? "rotate(180deg)" : "none",
          }}
        >
          ›
        </span>
      </button>

      {/* Layer section */}
      <div className="px-2 mb-2">
        {sidebarOpen && (
          <div
            className="gs-label mb-2 px-1.5"
            style={{ fontSize: 10, fontWeight: 600, color: "#777777" }}
          >
            Data layers
          </div>
        )}
        {LAYERS.map((layer) => {
          const on = activeLayers.includes(layer.id);
          return (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className="layer-btn w-full flex items-center gap-2.5 rounded-lg mb-0.5"
              style={{
                padding:    "9px 8px",
                background: on ? "#F0F0F0" : "transparent",
                border:     `1px solid ${on ? "#E5E5E5" : "transparent"}`,
                cursor:     "pointer",
                textAlign:  "left",
                transition: "all 0.15s ease",
              }}
            >
              <span
                className="leading-none flex-shrink-0"
                style={{
                  fontSize:   14,
                  color:      layer.icon === "📍" ? "#FF6B6B" : 
                              layer.icon === "🗺️" ? "#14B8A6" :
                              layer.icon === "🏢" ? "#FFB84D" :
                              "#14B8A6",
                  transition: "color 0.15s",
                }}
              >
                {layer.icon}
              </span>
              {sidebarOpen && (
                <span
                  className="whitespace-nowrap"
                  style={{
                    fontSize: 12,
                    fontWeight: on ? 600 : 400,
                    color:    on ? "#000000" : "#666666",
                  }}
                >
                  {layer.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overlay section (only when expanded) */}
      {sidebarOpen && (
        <>
          <div
            style={{
              height:     1,
              background: "#E5E5E5",
              margin:     "0 8px 8px",
            }}
          />
          <div className="px-2">
            <div className="gs-label mb-2 px-1.5" style={{ fontSize: 10, fontWeight: 600, color: "#777777" }}>
              Overlays
            </div>
            {[
              { key: "heatmap",    label: "Heatmap"    },
              { key: "clusters",   label: "Clusters"   },
              { key: "hotspots",   label: "Hotspots"   },
              { key: "isochrones", label: "Isochrones" },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between px-2 py-2 rounded-lg"
              >
                <span style={{ fontSize: 12, color: "#333333", fontWeight: 500 }}>
                  {label}
                </span>
                <Toggle
                  on={overlays[key]}
                  onChange={() => toggleOverlay(key)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
