/**
 * ScoreBar
 * @param {string} label
 * @param {number} value  0-100
 * @param {number} height bar height in px (default 2)
 */
export default function ScoreBar({ label, value, height = 2 }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-center mb-1">
        <span style={{ fontSize: 10, color: "#666666" }}>{label}</span>
        <span className="gs-mono font-medium" style={{ fontSize: 10, color: "#333333" }}>
          {value}
        </span>
      </div>
      <div
        className="w-full rounded-full"
        style={{ height, background: "#E5E5E5" }}
      >
        <div
          className="rounded-full"
          style={{
            height:     "100%",
            width:      `${value}%`,
            background: "#000000",
            transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}
