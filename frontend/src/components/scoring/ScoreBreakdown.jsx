import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

const LAYER_LABELS = {
  demographics: "Demographics",
  transport:    "Transport",
  competitors:  "Competitors",
  zoning:       "Zoning",
  environment:  "Environment",
};

/**
 * ScoreBreakdown
 * @param {object} breakdown  { demographics, transport, competitors, zoning, environment }
 *                            Values are 0–100 (after normalization in api.js).
 */
export default function ScoreBreakdown({ breakdown }) {
  const data = Object.entries(LAYER_LABELS).map(([key, label]) => ({
    subject: label,
    value:   Math.round(breakdown[key] ?? 0),
  }));

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
          {/* Domain 0-100 because sub-scores are now expressed as 0-100 */}
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} tickCount={4} />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#14B8A6"
            fill="#14B8A6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}