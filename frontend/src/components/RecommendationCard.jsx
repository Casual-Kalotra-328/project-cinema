import TierBadge from "./TierBadge"
import { GenreChipList } from "./GenreChip"

function cleanTitle(title) {
  return title?.replace(/\s*\(\d{4}\)\s*/g, "").trim() ?? title
}

function ConfidenceArc({ score, color }) {
  const pct  = Math.round(score * 100)
  const r    = 18
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(200,168,90,0.2)" strokeWidth="3"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 22 22)" style={{ transition:"stroke-dasharray 0.8s ease" }}/>
        <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="600" fill={color}>
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize:"11px", color:"var(--muted2)", letterSpacing:"0.04em" }}>match</span>
    </div>
  )
}

function ShapFactors({ factors = [] }) {
  if (!factors.length) return null
  const max = Math.max(...factors.map(f => f.pct), 1)
  return (
    <div style={{ marginTop:"16px" }}>
      <p style={{ fontSize:"10px", letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--muted2)", marginBottom:"8px" }}>
        Why this film
      </p>
      {factors.slice(0,3).map(f => (
        <div key={f.feature} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"5px" }}>
          <span style={{ fontSize:"10px", color:f.direction==="up"?"var(--accent2)":"var(--muted2)", minWidth:"8px" }}>
            {f.direction==="up"?"↑":"↓"}
          </span>
          <span style={{ fontSize:"11px", color:"var(--muted)", minWidth:"130px" }}>{f.label}</span>
          <div style={{ flex:1, height:"4px", background:"rgba(200,168,90,0.15)", borderRadius:"2px", overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${(f.pct/max)*100}%`,
              background:f.direction==="up"?"var(--accent3)":"var(--muted2)",
              borderRadius:"2px", transition:"width 0.6s ease",
            }}/>
          </div>
          <span style={{ fontSize:"10px", color:"var(--muted2)", minWidth:"28px", textAlign:"right" }}>{f.pct}%</span>
        </div>
      ))}
    </div>
  )
}

// ── TMDB card ─────────────────────────────────────────────────
function TmdbCard({ rec, delay, onRate }) {
  const title = cleanTitle(rec.title)
  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}ms`,
      background:     "var(--surface)",
      border:         "1px solid var(--border)",
      borderRadius:   "14px",
      overflow:       "hidden",
      flex:           "1",
      minWidth:       "220px",
      maxWidth:       "260px",
      transition:     "transform 0.3s, box-shadow 0.3s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-6px)"; e.currentTarget.style.boxShadow="0 16px 48px rgba(138,82,8,0.14)" }}
      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none" }}
    >
      {rec.poster && (
        <div style={{ height:"200px", overflow:"hidden", background:"var(--sand2)", position:"relative" }}>
          <img src={rec.poster} alt={title}
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, height:"80px",
            background:"linear-gradient(to top, var(--surface), transparent)",
          }}/>
        </div>
      )}
      <div style={{ padding:"16px" }}>
        <span style={{
          fontSize:"9px", letterSpacing:"0.12em", textTransform:"uppercase",
          color:"var(--blue2)", background:"rgba(30,120,180,0.1)",
          padding:"2px 7px", borderRadius:"4px", display:"inline-block", marginBottom:"8px",
        }}>TMDB pick</span>
        <h3 style={{ fontSize:"14px", fontWeight:700, color:"var(--accent2)", marginBottom:"4px", lineHeight:1.2 }}>
          {title}
        </h3>
        {rec.release_year && (
          <p style={{ fontSize:"11px", color:"var(--muted2)", marginBottom:"8px" }}>{rec.release_year}</p>
        )}
        {rec.overview && (
          <p style={{
            fontSize:"12px", color:"var(--muted)", lineHeight:1.6, marginBottom:"12px",
            display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden",
          }}>{rec.overview}</p>
        )}
        <div style={{ display:"flex", gap:"8px", paddingTop:"10px", borderTop:"1px solid var(--border)" }}>
          <button onClick={onRate} style={{
            flex:1, padding:"7px", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase",
            background:"var(--accent2)", color:"var(--sand)", border:"none", borderRadius:"6px",
            cursor:"pointer", fontWeight:600,
          }}>Rate it</button>
          <button style={{
            flex:1, padding:"7px", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase",
            background:"transparent", color:"var(--muted)", border:"1px solid var(--border2)",
            borderRadius:"6px", cursor:"pointer",
          }}>Watchlist</button>
        </div>
      </div>
    </div>
  )
}

// ── Cinematic Poster ──────────────────────────────────────────
function CinematicPoster({ poster, title, rankLabel, tierColor, isFeatured }) {
  return (
    <div style={{
      position:   "relative",
      width:      "100%",
      height:     isFeatured ? "260px" : "210px",
      overflow:   "hidden",
      borderRadius: "10px 10px 0 0",
      flexShrink: 0,
      background: "var(--sand2)",
    }}>
      {/* Poster image */}
      <img
        src={poster}
        alt={title}
        style={{
          width:"100%", height:"100%", objectFit:"cover", display:"block",
          transition: "transform 0.5s ease",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      />

      {/* Tier glow overlay */}
      <div style={{
        position:"absolute", inset:0,
        background:`radial-gradient(ellipse at 50% 110%, ${tierColor}28 0%, transparent 65%)`,
        pointerEvents:"none",
      }}/>

      {/* Bottom fade into card */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:"110px",
        background:"linear-gradient(to top, var(--surface) 0%, transparent 100%)",
        pointerEvents:"none",
      }}/>

      {/* Rank label chip — top left */}
      <div style={{
        position:"absolute", top:"12px", left:"12px",
        fontSize:"9px", letterSpacing:"0.18em", textTransform:"uppercase",
        color:"#fff",
        background:"rgba(0,0,0,0.52)",
        backdropFilter:"blur(6px)",
        padding:"3px 9px", borderRadius:"20px",
        fontWeight:600,
      }}>
        {rankLabel}
      </div>
    </div>
  )
}

// ── ML card ───────────────────────────────────────────────────
export default function RecommendationCard({ rec, rank=1, delay=0, onRate }) {
  const isFeatured = rank === 1
  const isTmdb     = rec.source === "tmdb"
  const title      = cleanTitle(rec.title)
  const tierColor  = rec.tier_color ?? "var(--accent3)"

  if (isTmdb) return <TmdbCard rec={rec} delay={delay} onRate={onRate}/>

  const rankLabel = rank===1 ? "Top pick" : rank===2 ? "Also great" : "You might like"

  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}ms`,
      background:     "var(--surface)",
      border:         `1px solid ${isFeatured ? tierColor+"55" : "var(--border)"}`,
      borderRadius:   "14px",
      position:       "relative",
      overflow:       "hidden",
      flex:           isFeatured ? "1.3" : "1",
      minWidth:       "260px",
      display:        "flex",
      flexDirection:  "column",
      transition:     "transform 0.35s, box-shadow 0.35s",
      boxShadow:      isFeatured ? `0 0 0 1px ${tierColor}22, 0 8px 32px ${tierColor}18` : "none",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-6px)"
        e.currentTarget.style.boxShadow = `0 20px 56px ${tierColor}28, 0 0 0 1px ${tierColor}44`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = isFeatured
          ? `0 0 0 1px ${tierColor}22, 0 8px 32px ${tierColor}18`
          : "none"
      }}
    >
      {/* Top accent bar on featured */}
      {isFeatured && (
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:"3px", zIndex:2,
          background:`linear-gradient(90deg, ${tierColor}, var(--accent3), var(--blue2))`,
        }}/>
      )}

      {/* Cinematic poster */}
      {rec.poster && (
        <CinematicPoster
          poster={rec.poster}
          title={title}
          rankLabel={rankLabel}
          tierColor={tierColor}
          isFeatured={isFeatured}
        />
      )}

      {/* Card body */}
      <div style={{ padding: isFeatured ? "20px 24px 24px" : "16px 20px 20px", flex:1, display:"flex", flexDirection:"column" }}>

        {/* Title row */}
        {!rec.poster && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
            <span style={{ fontSize:"10px", letterSpacing:"0.2em", color:"var(--muted2)", textTransform:"uppercase" }}>
              {rankLabel}
            </span>
            <ConfidenceArc score={rec.hybrid_score ?? 0.5} color={tierColor}/>
          </div>
        )}

        <h3 style={{
          fontSize: isFeatured ? "18px" : "15px",
          fontWeight: 700, color:"var(--accent2)",
          letterSpacing:"-0.01em", lineHeight:1.25,
          marginBottom:"4px",
        }}>
          {title}
        </h3>

        {rec.release_year && (
          <p style={{ fontSize:"11px", color:"var(--muted2)", marginBottom:"10px" }}>{rec.release_year}</p>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
          <TierBadge tier={rec.predicted_tier} size={isFeatured ? "md" : "sm"}/>
          {rec.poster && (
            <ConfidenceArc score={rec.hybrid_score ?? 0.5} color={tierColor}/>
          )}
        </div>

        <GenreChipList chips={rec.genre_chips ?? []} size="sm"/>

        <div style={{ height:"1px", background:"var(--border)", opacity:0.5, margin:"14px 0" }}/>

        <p style={{ fontSize:"12px", fontWeight:600, color:"var(--accent2)", letterSpacing:"0.02em", marginBottom:"8px" }}>
          {rec.match_reason ?? "Strong match"}
        </p>

        {rec.llm_explanation && (
          <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.75, marginBottom:"4px", flex:1 }}>
            {rec.llm_explanation}
          </p>
        )}

        <ShapFactors factors={rec.shap_factors ?? []}/>

        <div style={{ display:"flex", gap:"8px", marginTop:"20px", paddingTop:"16px", borderTop:"1px solid var(--border)" }}>
          <button onClick={onRate} style={{
            flex:1, padding:"9px", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase",
            background:"var(--accent2)", color:"var(--sand)", border:"none", borderRadius:"8px",
            cursor:"pointer", fontWeight:700, transition:"background 0.2s, transform 0.15s",
          }}
            onMouseEnter={e => { e.target.style.background="var(--accent)"; e.target.style.transform="scale(1.02)" }}
            onMouseLeave={e => { e.target.style.background="var(--accent2)"; e.target.style.transform="scale(1)" }}
          >Rate it</button>
          <button style={{
            flex:1, padding:"9px", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase",
            background:"transparent", color:"var(--muted)", border:"1px solid var(--border2)",
            borderRadius:"8px", cursor:"pointer", transition:"border-color 0.2s, color 0.2s",
          }}
            onMouseEnter={e => { e.target.style.borderColor="var(--accent2)"; e.target.style.color="var(--accent2)" }}
            onMouseLeave={e => { e.target.style.borderColor="var(--border2)"; e.target.style.color="var(--muted)" }}
          >Watchlist</button>
        </div>
      </div>
    </div>
  )
}