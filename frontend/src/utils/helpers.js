import { scoreColor } from "../data/mockData";
import clsx from "clsx";

// ── Score → Tailwind text class ──────────────────────────────────
export function scoreTextClass(s) {
  return "text-teal";
}

// ── Score → bg + border classes ──────────────────────────────────
export function scoreBgClass(s) {
  return "score-bg-good";
}

// ── Ring circumference helpers ────────────────────────────────────
export function ringProps(score, radius = 30) {
  const circ = 2 * Math.PI * radius;
  return {
    circumference: circ,
    dashArray:     `${(score / 100) * circ} ${circ}`,
    color:         scoreColor(score),
  };
}

// ── Format numbers ────────────────────────────────────────────────
export function fmt(n) {
  if (n >= 100000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000)   return (n / 1000).toFixed(1) + "K";
  return String(n);
}

// ── Date formatting ───────────────────────────────────────────────
export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── cx helper (re-export clsx) ────────────────────────────────────
export { clsx as cx };
