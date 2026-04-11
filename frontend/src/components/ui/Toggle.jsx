/**
 * Toggle
 * @param {boolean}  on
 * @param {function} onChange
 */
export default function Toggle({ on, onChange }) {
  return (
    <div
      className="relative cursor-pointer flex-shrink-0"
      style={{
        width:        30,
        height:       17,
        borderRadius: 9,
        background:   on ? "rgba(20,184,166,0.2)" : "#E5E5E5",
        transition:   "background 0.2s ease",
      }}
      onClick={onChange}
    >
      <div
        style={{
          position:     "absolute",
          top:          2.5,
          width:        12,
          height:       12,
          borderRadius: "50%",
          transition:   "all 0.2s ease",
          left:         on ? "auto" : 2.5,
          right:        on ? 2.5   : "auto",
          background:   on ? "#14B8A6" : "#CCCCCC",
        }}
      />
    </div>
  );
}
