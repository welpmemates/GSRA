import useStore from "../../store/useStore";
import { CITY_STATS } from "../../data/mockData";

export default function CoordBar() {
  const { sidebarOpen } = useStore();

  return (
    <div
      className="absolute bottom-8 gs-mono pointer-events-none"
      style={{
        left:           sidebarOpen ? 224 : 84,
        fontSize:       12,
        letterSpacing:  "0.05em",
        color:          "#666666",
        transition:     "left 0.26s cubic-bezier(0.4,0,0.2,1)",
        fontWeight:     500,
      }}
    >
      23.0225°N · 72.5714°E · z12 · {CITY_STATS.totalHexagons} hexagons · Gi* active
    </div>
  );
}
