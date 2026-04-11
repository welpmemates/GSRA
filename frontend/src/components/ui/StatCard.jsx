/**
 * StatCard
 * @param {string|number} value
 * @param {string}        label
 */
export default function StatCard({ value, label }) {
  return (
    <div
      className="text-center rounded-lg py-3 px-2"
      style={{ background: "#F8F8F8", border: "1px solid #E5E5E5" }}
    >
      <div
        className="gs-mono font-bold leading-none"
        style={{ fontSize: 18, color: "#000000" }}
      >
        {value}
      </div>
      <div className="mt-1.5" style={{ fontSize: 11, color: "#777777", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}
