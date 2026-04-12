import { useRef } from "react";
import useStore from "@/store/useStore";
import { scoreLocation, isInsideAhmedabad, AHMEDABAD_BBOX } from "@/api/api";

const BLOBS = [
  { cx: "28%", cy: "40%", rx: 135, ry: 96,  fill: "#14B8A6", op: 0.08 },
  { cx: "54%", cy: "53%", rx: 108, ry: 82,  fill: "#14B8A6", op: 0.10 },
  { cx: "70%", cy: "32%", rx: 90,  ry: 66,  fill: "#14B8A6", op: 0.08 },
  { cx: "40%", cy: "70%", rx: 74,  ry: 55,  fill: "#14B8A6", op: 0.06 },
];

const ROADS = [
  { d: "M0,308 C155,292 335,320 525,308 S726,292 924,310", sw: 2.5, op: 0.04 },
  { d: "M0,470 C185,454 374,474 562,456 S764,444 924,468", sw: 1.5, op: 0.03 },
  { d: "M268,0 C276,186 260,382 272,572 S266,712 270,820", sw: 1.5, op: 0.04 },
  { d: "M532,0 C520,202 538,406 522,606 S530,758 524,820", sw: 1.0, op: 0.03 },
  { d: "M0,190 C220,175 440,198 660,185 S840,175 924,192", sw: 1.0, op: 0.02 },
  { d: "M120,0 C128,160 115,340 124,520 S118,680 122,820", sw: 1.0, op: 0.02 },
];

const PINS = [
  { cx: "28%", cy: "40%", fill: "#14B8A6", r: 5.5, op: 0.88 },
  { cx: "54%", cy: "53%", fill: "#14B8A6", r: 5.5, op: 0.88 },
  { cx: "70%", cy: "32%", fill: "#14B8A6", r: 5.5, op: 0.88 },
  { cx: "40%", cy: "70%", fill: "#14B8A6", r: 4.0, op: 0.62 },
  { cx: "19%", cy: "62%", fill: "#14B8A6", r: 3.5, op: 0.52 },
  { cx: "78%", cy: "65%", fill: "#14B8A6", r: 3.5, op: 0.52 },
  { cx: "62%", cy: "78%", fill: "#14B8A6", r: 3.0, op: 0.48 },
  { cx: "36%", cy: "25%", fill: "#14B8A6", r: 3.0, op: 0.44 },
];

// Map pixel coords to Ahmedabad lat/lon
function pixelToLatLon(x, y, rectWidth, rectHeight) {
  const lonFrac = x / rectWidth;
  const latFrac = 1 - y / rectHeight; // y=0 is top → higher lat
  const lon = AHMEDABAD_BBOX.minLon + lonFrac * (AHMEDABAD_BBOX.maxLon - AHMEDABAD_BBOX.minLon);
  const lat = AHMEDABAD_BBOX.minLat + latFrac * (AHMEDABAD_BBOX.maxLat - AHMEDABAD_BBOX.minLat);
  return { lat, lon };
}


export default function MapCanvas() {
  const mapRef = useRef(null);
  const { setPopup, sidebarOpen, weights, useCase, addToast, setDroppedPin, droppedPin } = useStore();

  async function handleClick(e) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x  = e.clientX - rect.left;
    const y  = e.clientY - rect.top;
    const sw = sidebarOpen ? 216 : 80;

    // Guard: ignore clicks over UI panels
    if (x < sw || x > rect.width - 308 || y < 74) return;

    // Map pixel position to Ahmedabad lat/lon
    const mapX = x - sw;
    const mapW = rect.width - sw - 308;
    const { lat, lon } = pixelToLatLon(mapX, y, mapW, rect.height);

    // Enforce Ahmedabad bounding box
    if (!isInsideAhmedabad(lat, lon)) {
      addToast({ title: "Out of bounds", message: "Please click within Ahmedabad." });
      return;
    }

    // Store raw pixel coords directly — no roundtrip through lat/lon needed
    // This guarantees the pin renders exactly where the user clicked
    setDroppedPin({ px: x, py: y });

    try {
      const scoreData = await scoreLocation(lat, lon, weights, useCase);
      if (!scoreData) return;

      if (scoreData.__fallback) {
        addToast({ title: "Server fallback", message: "Scoring API unavailable; showing fallback values." });
      }

      setPopup({ x, y, lat, lng: lon, score: scoreData });
    } catch (err) {
      console.error("Scoring failed:", err);
      addToast({ title: "Score error", message: "Unable to retrieve score from the server." });
    }
  }

  // Pin pixel position comes straight from the click — no computation needed
  const pin = droppedPin ?? null;

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 cursor-crosshair"
      onClick={handleClick}
    >
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <defs>
          <pattern id="gs-dots" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.72" fill="rgba(20,184,166,0.12)" />
          </pattern>
          <filter id="gs-blob" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="34" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </radialGradient>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.35)" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#gs-dots)" />

        {BLOBS.map((b, i) => (
          <ellipse
            key={i}
            cx={b.cx} cy={b.cy}
            rx={b.rx} ry={b.ry}
            fill={b.fill}
            opacity={b.op}
            filter="url(#gs-blob)"
          />
        ))}

        {ROADS.map((r, i) => (
          <path
            key={i}
            d={r.d}
            stroke={`rgba(20,184,166,${r.op})`}
            strokeWidth={r.sw}
            fill="none"
          />
        ))}

        {PINS.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} opacity={p.op} />
            {p.r >= 4 && (
              <circle
                cx={p.cx} cy={p.cy}
                r={p.r * 2.2}
                fill="none"
                stroke={p.fill}
                strokeWidth="0.8"
                opacity={p.op * 0.35}
              />
            )}
          </g>
        ))}

        {/* ── Dropped pin: shows where the user last clicked ── */}
        {pin && (
          <g filter="url(#pin-shadow)">
            {/* Pulsing halo */}
            <circle cx={pin.px} cy={pin.py} r={18} fill="rgba(20,184,166,0.12)" />
            <circle cx={pin.px} cy={pin.py} r={10} fill="rgba(20,184,166,0.20)" />
            {/* Pin teardrop body */}
            <path
              d={`M${pin.px},${pin.py + 22} C${pin.px - 12},${pin.py + 6} ${pin.px - 12},${pin.py - 14} ${pin.px},${pin.py - 16} C${pin.px + 12},${pin.py - 14} ${pin.px + 12},${pin.py + 6} ${pin.px},${pin.py + 22} Z`}
              fill="#14B8A6"
            />
            {/* Pin inner dot */}
            <circle cx={pin.px} cy={pin.py - 6} r={4} fill="#FFFFFF" opacity={0.9} />
          </g>
        )}

        <rect width="100%" height="100%" fill="url(#vignette)" />
      </svg>
    </div>
  );
}
