// ── Use-case weight profiles ─────────────────────────────────────
export const USE_CASES = ["Retail", "EV Charging", "Warehouse", "Telecom", "Grocery Store", "Clothing Store", "Electronics Store", "Pharmacy", "Luxury Retail"];

export const WEIGHT_PROFILES = {
  Retail:       { demographics:0.30, transport:0.25, competitors:0.20, zoning:0.15, environment:0.10 },
  "EV Charging":{ demographics:0.10, transport:0.45, competitors:0.10, zoning:0.20, environment:0.15 },
  Warehouse:    { demographics:0.05, transport:0.40, competitors:0.05, zoning:0.35, environment:0.15 },
  Telecom:      { demographics:0.20, transport:0.20, competitors:0.05, zoning:0.30, environment:0.25 },
  "Grocery Store": { demographics: 0.40, transport: 0.30, competitors: 0.10, zoning: 0.10, environment: 0.10 },
  "Clothing Store": { demographics: 0.30, transport: 0.25, competitors: 0.25, zoning: 0.10, environment: 0.10 },
  "Electronics Store": { demographics: 0.25, transport: 0.35, competitors: 0.20, zoning: 0.10, environment: 0.10 },
  "Pharmacy": { demographics: 0.35, transport: 0.25, competitors: 0.10, zoning: 0.10, environment: 0.20 },
  "Luxury Retail": { demographics: 0.20, transport: 0.30, competitors: 0.15, zoning: 0.20, environment: 0.15 },
};

// ── Data layers ─────────────────────────────────────────────────
export const LAYERS = [
  { id: "demo",  label: "Demographics",       icon: "◉", description: "Population density, income, age distribution" },
  { id: "roads", label: "Roads & transit",    icon: "⊟", description: "Highway proximity, road density, transit stops" },
  { id: "poi",   label: "Points of interest", icon: "◈", description: "Competitors, malls, anchor tenants" },
  { id: "zone",  label: "Zoning",             icon: "⊡", description: "Commercial, industrial, residential zones" },
  { id: "flood", label: "Flood risk",         icon: "◌", description: "FEMA flood zones, air quality index" },
  { id: "h3",    label: "H3 Hexagons",        icon: "⬡", description: "H3 spatial index with scoring" },
];

// ── Hot zones (pre-computed from DBSCAN + Gi*) ──────────────────
export const HOT_ZONES = [
  {
    id: "zone-a",
    name: "North corridor",
    rank: 1,
    score: 87,
    hexCount: 47,
    area: "34.3",
    giConfidence: "99%",
    avgIncome: "₹68,000",
    population: "2.1L",
    competitors: 3,
    lat: 23.065, lng: 72.548,
    breakdown: { demographics:26, transport:22, competitors:18, zoning:13, environment:8 },
  },
  {
    id: "zone-b",
    name: "Central hub",
    rank: 2,
    score: 74,
    hexCount: 31,
    area: "22.6",
    giConfidence: "95%",
    avgIncome: "₹55,000",
    population: "1.8L",
    competitors: 5,
    lat: 23.034, lng: 72.571,
    breakdown: { demographics:21, transport:19, competitors:13, zoning:13, environment:8 },
  },
  {
    id: "zone-c",
    name: "East district",
    rank: 3,
    score: 63,
    hexCount: 19,
    area: "13.9",
    giConfidence: "90%",
    avgIncome: "₹42,000",
    population: "0.9L",
    competitors: 2,
    lat: 23.041, lng: 72.612,
    breakdown: { demographics:17, transport:16, competitors:11, zoning:11, environment:8 },
  },
  {
    id: "zone-d",
    name: "South market",
    rank: 4,
    score: 44,
    hexCount: 12,
    area: "8.8",
    giConfidence: "—",
    avgIncome: "₹28,000",
    population: "0.5L",
    competitors: 9,
    lat: 22.989, lng: 72.557,
    breakdown: { demographics:10, transport:12, competitors:7, zoning:9, environment:6 },
  },
];

// ── City stats ──────────────────────────────────────────────────
export const CITY_STATS = {
  city: "Ahmedabad",
  totalHexagons: 487,
  clusters: 6,
  giHotspots: 31,
  avgScore: 61,
  analyzedAt: "2024-03-15T10:30:00Z",
};

// ── Comparison sites (for Compare page) ─────────────────────────
export const COMPARE_SITES = [
  {
    id: "site-1",
    label: "Site A",
    address: "SG Highway, Ahmedabad",
    lat: 23.065, lng: 72.548,
    useCase: "Retail",
    score: 87,
    breakdown: { demographics:26, transport:22, competitors:18, zoning:13, environment:8 },
    verdict: "excellent",
    population5km: "2.1L",
    highwayDist: "340 m",
    competitorCount: 3,
    zoneType: "Commercial",
    floodZone: "Zone X",
  },
  {
    id: "site-2",
    label: "Site B",
    address: "CG Road, Ahmedabad",
    lat: 23.034, lng: 72.571,
    useCase: "Retail",
    score: 74,
    breakdown: { demographics:21, transport:19, competitors:13, zoning:13, environment:8 },
    verdict: "good",
    population5km: "1.8L",
    highwayDist: "1.2 km",
    competitorCount: 5,
    zoneType: "Mixed use",
    floodZone: "Zone X",
  },
  {
    id: "site-3",
    label: "Site C",
    address: "GIDC Vatva, Ahmedabad",
    lat: 22.987, lng: 72.622,
    useCase: "Retail",
    score: 44,
    breakdown: { demographics:10, transport:12, competitors:7, zoning:9, environment:6 },
    verdict: "poor",
    population5km: "0.5L",
    highwayDist: "3.8 km",
    competitorCount: 9,
    zoneType: "Industrial",
    floodZone: "Zone AE",
  },
];

// ── Recent activity (for sidebar feed) ──────────────────────────
export const RECENT_ACTIVITY = [
  { id:1, type:"score",   text:"Site at 23.065°N scored 87", time:"2 min ago",  color:"mint"  },
  { id:2, type:"cluster", text:"New hot zone detected north", time:"8 min ago",  color:"gold"  },
  { id:3, type:"alert",   text:"Flood risk update in Zone AE",time:"14 min ago", color:"coral" },
  { id:4, type:"score",   text:"Site at 23.041°N scored 63", time:"22 min ago", color:"mid"   },
];

// ── AI query suggestions ─────────────────────────────────────────
export const AI_SUGGESTIONS = [
  "Find best retail location near highway with low flood risk",
  "Show EV charging opportunities in underserved areas",
  "Compare warehouse zones by transport score",
  "Highlight Gi* 99% confidence hotspots only",
];

// ── Scoring color helper ─────────────────────────────────────────
export function scoreColor(s) {
  return "#14B8A6"; // Always teal
}

export function scoreLabel(s) {
  if (s >= 80) return "Excellent";
  if (s >= 65) return "Good";
  if (s >= 50) return "Average";
  if (s >= 30) return "Poor";
  return "Disqualified";
}

export function scoreVerdict(s) {
  if (s >= 70) return "Excellent — highly recommended";
  if (s >= 50) return "Viable with moderate considerations";
  return "Below threshold — not advised";
}

export function scoreVerdictClass(s) {
  if (s >= 70) return "score-bg-good";
  if (s >= 50) return "score-bg-warn";
  return "score-bg-bad";
}

// ── Random score generator (for map click demo) ─────────────────
export function randScore() {
  const t = Math.floor(Math.random() * 46) + 40;
  return {
    total:       t,
    demographics:Math.floor(Math.random() * 38) + 48,
    transport:   Math.floor(Math.random() * 32) + 55,
    competitors: Math.floor(Math.random() * 52) + 28,
    zoning:      Math.floor(Math.random() * 28) + 58,
    environment: Math.floor(Math.random() * 48) + 30,
  };
}
