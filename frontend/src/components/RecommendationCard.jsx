// ============================================================
//  RecommendationCard.jsx
//  The top-3 cinematic recommendation card
//  Props:
//    rec     — recommendation object from the ML pipeline
//    rank    — 1 | 2 | 3  (1 = largest/featured)
//    delay   — animation delay in ms
// ============================================================

import TierBadge from "./TierBadge"
import { GenreChipList } from "./GenreChip"

// Strip ALL year occurrences from title
// handles "Die Hard (1988) (1988)" → "Die Hard"
function cleanTitle(title) {
  return title?.replace(/\s*\(\d{4}\)\s*/g, "").trim() ?? title
}

// Confidence arc — SVG circle showing hybrid score as %
function ConfidenceArc({ score, color }) {
  const pct    = Math.round(score * 100)
  const r      = 18
  const circ   = 2 * Math.PI * r
  const dash   = (pct / 100) * circ

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        {/* Track */}
        <circle
          cx="22" cy="22" r={r}
          fill="none"
          stroke="rgba(200,168,90,0.2)"
          strokeWidth="3"
        />
        {/* Fill */}
        <circle
          cx="22" cy="22" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        {/* Label */}
        <text
          x="22" y="26"
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill={color}
        >
          {pct}%
        </text>
      </svg>
      <span style={{
        fontSize: "11px",
        color: "var(--muted2)",
        letterSpacing: "0.04em"
      }}>
        match
      </span>
    </div>
  )
}

// SHAP factor mini-bars shown inside the card
function ShapFactors({ factors = [] }) {
  if (!factors.length) return null
  const max = Math.max(...factors.map(f => f.pct), 1)

  return (
    <div style={{ marginTop: "16px" }}>
      <p style={{
        fontSize: "10px",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "var(--muted2)",
        marginBottom: "8px"
      }}>
        Why this film
      </p>
      {factors.slice(0, 3).map(f => (
        <div key={f.feature} style={{
          display: "flex", alignItems: "center",
          gap: "8px", marginBottom: "5px"
        }}>
          <span style={{
            fontSize: "10px",
            color: f.direction === "up" ? "var(--accent2)" : "var(--muted2)",
            minWidth: "8px"
          }}>
            {f.direction === "up" ? "↑" : "↓"}
          </span>
          <span style={{
            fontSize: "11px",
            color: "var(--muted)",
            minWidth: "130px"
          }}>
            {f.label}
          </span>
          {/* Bar */}
          <div style={{
            flex: 1,
            height: "4px",
            background: "rgba(200,168,90,0.15)",
            borderRadius: "2px",
            overflow: "hidden"
          }}>
            <div style={{
              height: "100%",
              width: `${(f.pct / max) * 100}%`,
              background: f.direction === "up"
                ? "var(--accent3)"
                : "var(--muted2)",
              borderRadius: "2px",
              transition: "width 0.6s ease"
            }} />
          </div>
          <span style={{
            fontSize: "10px",
            color: "var(--muted2)",
            minWidth: "28px",
            textAlign: "right"
          }}>
            {f.pct}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function RecommendationCard({ rec, rank = 1, delay = 0, onRate }) {
  const isFeatured = rank === 1
  const title      = cleanTitle(rec.title)
  const tierColor  = rec.tier_color ?? "var(--accent3)"

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${delay}ms`,
        background:     "var(--surface)",
        border:         `1px solid ${isFeatured
          ? "var(--border2)"
          : "var(--border)"}`,
        borderRadius:   "12px",
        padding:        isFeatured ? "28px" : "22px",
        position:       "relative",
        overflow:       "hidden",
        flex:           isFeatured ? "1.3" : "1",
        minWidth:       "260px",
        transition:     "transform 0.3s, box-shadow 0.3s",
        cursor:         "default",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform  = "translateY(-4px)"
        e.currentTarget.style.boxShadow = `0 12px 40px rgba(138,82,8,0.12)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform  = "translateY(0)"
        e.currentTarget.style.boxShadow = "none"
      }}
    >
      {/* Featured glow line */}
      {isFeatured && (
        <div style={{
          position:   "absolute",
          top:        0, left: 0, right: 0,
          height:     "3px",
          background: `linear-gradient(90deg, var(--accent2), var(--accent3), var(--blue2))`,
        }} />
      )}

      {/* Rank label */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "flex-start",
        marginBottom:   "14px"
      }}>
        <span style={{
          fontSize:      "10px",
          letterSpacing: "0.2em",
          color:         "var(--muted2)",
          textTransform: "uppercase"
        }}>
          {rank === 1 ? "Top pick" : rank === 2 ? "Also great" : "You might like"}
        </span>
        <ConfidenceArc
          score={rec.hybrid_score ?? 0.5}
          color={tierColor}
        />
      </div>

      {/* Title */}
      <h3 style={{
        fontSize:      isFeatured ? "20px" : "17px",
        fontWeight:    700,
        color:         "var(--accent2)",
        letterSpacing: "-0.01em",
        lineHeight:    1.2,
        marginBottom:  "6px",
      }}>
        {title}
      </h3>

      {/* Year */}
      {rec.release_year && (
        <p style={{
          fontSize:     "12px",
          color:        "var(--muted2)",
          marginBottom: "12px"
        }}>
          {rec.release_year}
        </p>
      )}

      {/* Tier badge */}
      <div style={{ marginBottom: "12px" }}>
        <TierBadge tier={rec.predicted_tier} size={isFeatured ? "md" : "sm"} />
      </div>

      {/* Genre chips */}
      <div style={{ marginBottom: "16px" }}>
        <GenreChipList chips={rec.genre_chips ?? []} size="sm" />
      </div>

      {/* Divider */}
      <div style={{
        height:       "1px",
        background:   "var(--border)",
        opacity:      0.5,
        marginBottom: "14px"
      }} />

      {/* Match reason headline */}
      <p style={{
        fontSize:     "12px",
        fontWeight:   600,
        color:        "var(--accent2)",
        letterSpacing:"0.02em",
        marginBottom: "8px"
      }}>
        {rec.match_reason ?? "Strong match"}
      </p>

      {/* LLM explanation */}
      {rec.llm_explanation && (
        <p style={{
          fontSize:    "13px",
          color:       "var(--muted)",
          lineHeight:  1.75,
          marginBottom:"16px"
        }}>
          {rec.llm_explanation}
        </p>
      )}

      {/* SHAP factors */}
      <ShapFactors factors={rec.shap_factors ?? []} />

      {/* Actions */}
      <div style={{
        display:       "flex",
        gap:           "8px",
        marginTop:     "20px",
        paddingTop:    "16px",
        borderTop:     "1px solid var(--border)",
        opacity:       0.9
      }}>
        <button style={{
          flex:1, padding:"8px", fontSize:"11px", letterSpacing:"0.1em",
          textTransform:"uppercase", background:"var(--accent2)", color:"var(--sand)",
          border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:600, transition:"background 0.2s"
        }}
          onClick={onRate}
          onMouseEnter={e=>e.target.style.background="var(--accent)"}
          onMouseLeave={e=>e.target.style.background="var(--accent2)"}
        >
          Rate it
        </button>
        <button style={{
          flex:          1,
          padding:       "8px",
          fontSize:      "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background:    "transparent",
          color:         "var(--muted)",
          border:        "1px solid var(--border2)",
          borderRadius:  "6px",
          cursor:        "pointer",
          transition:    "border-color 0.2s, color 0.2s"
        }}
          onMouseEnter={e => {
            e.target.style.borderColor = "var(--accent2)"
            e.target.style.color       = "var(--accent2)"
          }}
          onMouseLeave={e => {
            e.target.style.borderColor = "var(--border2)"
            e.target.style.color       = "var(--muted)"
          }}
        >
          Watchlist
        </button>
      </div>
    </div>
  )
}