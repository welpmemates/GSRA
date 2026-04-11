import { ringProps } from "../../utils/helpers";

/**
 * ScoreRing
 * @param {number}  score   0-100
 * @param {number}  size    SVG dimensions in px
 * @param {number}  sw      stroke-width
 */
export default function ScoreRing({ score, size = 80, sw = 6 }) {
  const radius = (size - sw * 2 - 4) / 2;
  const cx     = size / 2;
  const cy     = size / 2;
  const { circumference, dashArray, color } = ringProps(score, radius);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgba(20,184,166,0.15)"
          strokeWidth={sw}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.85s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>

      {/* Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="gs-mono font-medium leading-none"
          style={{ fontSize: size > 80 ? 22 : size > 60 ? 16 : 13, color }}
        >
          {score}
        </span>
        <span className="gs-mono" style={{ fontSize: 8, color: "#999999" }}>
          /100
        </span>
      </div>
    </div>
  );
}
