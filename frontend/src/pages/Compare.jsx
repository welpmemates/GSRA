import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/layout/Navbar";
import useStore from "../store/useStore";
import { scoreLocation } from "../api/api";

export default function Compare() {
  const { comparedSites, removeCompare, clearCompare, weights, useCase, addToast } = useStore();
  const [sites, setSites] = useState([]);

  useEffect(() => {
    let active = true;
    if (comparedSites.length > 0) {
      Promise.all(
        comparedSites.map(async (site) => {
          if (!site.lat || !site.lng) {
            // Use cached score shape (already normalized by api.js)
            return {
              ...site,
              score: site.score?.total ?? site.score ?? 0,
              breakdown: {
                demographics: site.score?.demographics ?? 0,
                transport:    site.score?.transport     ?? 0,
                competitors:  site.score?.competitors   ?? 0,
                zoning:       site.score?.zoning        ?? 0,
                environment:  site.score?.environment   ?? 0,
              },
            };
          }

          try {
            // scoreLocation already returns normalized shape via normalizeScoreResponse
            const latest = await scoreLocation(site.lat, site.lng, weights, useCase);
            if (!latest) return site; // outside bbox

            if (latest.__fallback) {
              addToast({ title: "Server fallback", message: "Compare scoring is using fallback data." });
            }
            return {
              ...site,
              score: latest.total ?? 0,
              breakdown: {
                demographics: latest.demographics ?? 0,
                transport:    latest.transport     ?? 0,
                competitors:  latest.competitors   ?? 0,
                zoning:       latest.zoning        ?? 0,
                environment:  latest.environment   ?? 0,
              },
            };
          } catch (err) {
            console.warn("Compare score fetch failed", err);
            return site;
          }
        })
      ).then((updated) => {
        if (active) setSites(updated);
      });
    } else {
      setSites([]);
    }
    return () => { active = false; };
  }, [comparedSites, weights, useCase, addToast]);

  const best = useMemo(() => {
    if (!sites.length) return null;
    return sites.reduce((b, s) => ((s.score ?? 0) > (b.score ?? 0) ? s : b), sites[0]);
  }, [sites]);

  const BREAKDOWN_LABELS = [
    ["demographics", "Demographics"],
    ["transport",    "Transport"],
    ["competitors",  "Competitors"],
    ["zoning",       "Zoning"],
    ["environment",  "Environment"],
  ];

  return (
    <div className="relative min-h-screen bg-white" style={{ color: "#000000" }}>
      <Navbar />

      <div className="pt-20 px-8 pb-16">
        {/* Page header */}
        <div className="flex items-end justify-between mb-10 pt-2">
          <div>
            <h1 className="font-bold" style={{ fontSize: 32, color: "#000000", marginBottom: 8 }}>
              Compare candidate sites
            </h1>
            <p style={{ fontSize: 14, color: "#555555" }}>
              Side-by-side scoring breakdown across all geospatial layers
            </p>
          </div>
          <button
            onClick={clearCompare}
            disabled={!comparedSites.length}
            className="px-5 py-2.5 cursor-pointer"
            style={{
              fontSize: 13, color: "#000000", background: "#F0F0F0",
              border: "1px solid #E0E0E0", borderRadius: 6, transition: "background 0.2s",
              opacity: comparedSites.length ? 1 : 0.5,
              cursor: comparedSites.length ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (comparedSites.length) e.target.style.background = "#E5E5E5"; }}
            onMouseLeave={(e) => { if (comparedSites.length) e.target.style.background = "#F0F0F0"; }}
          >
            Clear all
          </button>
        </div>

        {sites.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{ minHeight: 300, color: "#888", fontSize: 15 }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
            <div>No sites to compare yet.</div>
            <div style={{ fontSize: 13, marginTop: 8, color: "#aaa" }}>
              Click a location on the map and press &ldquo;+ Compare&rdquo;.
            </div>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${sites.length}, 1fr)` }}>
            {sites.map((site) => {
              const isBest = best && site.id === best.id;
              return (
                <div
                  key={site.id}
                  style={{
                    background:   "#FFFFFF",
                    border:       isBest ? "2px solid #14B8A6" : "1px solid #E5E5E5",
                    borderRadius: 8,
                    padding:      24,
                    position:     "relative",
                  }}
                >
                  {isBest && (
                    <div
                      style={{
                        position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                        background: "#14B8A6", color: "#fff", fontSize: 11, fontWeight: 700,
                        padding: "2px 12px", borderRadius: 99,
                      }}
                    >
                      Best site
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>
                        {site.label ?? "Site"}
                      </div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                        {Number(site.lat).toFixed(4)}°N · {Number(site.lng).toFixed(4)}°E
                      </div>
                    </div>
                    <button
                      onClick={() => removeCompare(site.id)}
                      style={{
                        border: "1px solid #E5E5E5", background: "#F8F8F8",
                        borderRadius: 6, width: 28, height: 28,
                        cursor: "pointer", fontSize: 13, color: "#666",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Score */}
                  <div
                    style={{
                      fontSize: 48, fontWeight: 700, color: "#000",
                      marginBottom: 20, lineHeight: 1,
                    }}
                  >
                    {Math.round(site.score ?? 0)}
                    <span style={{ fontSize: 14, color: "#888", fontWeight: 400 }}>/100</span>
                  </div>

                  {/* Breakdown bars */}
                  {BREAKDOWN_LABELS.map(([key, label]) => {
                    const val = Math.round(site.breakdown?.[key] ?? 0);
                    return (
                      <div key={key} className="mb-3">
                        <div className="flex justify-between mb-1" style={{ fontSize: 12 }}>
                          <span style={{ color: "#555" }}>{label}</span>
                          <span style={{ fontWeight: 600 }}>{val}</span>
                        </div>
                        <div style={{ height: 4, background: "#F0F0F0", borderRadius: 99 }}>
                          <div
                            style={{
                              height: "100%", width: `${val}%`,
                              background: "#14B8A6", borderRadius: 99,
                              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}