import { useState, useEffect } from "react"
import TierBadge from "../components/TierBadge"
import { GenreChipList } from "../components/GenreChip"
import AvatarUpload, { Avatar } from "../components/AvatarUpload"

const API = "http://localhost:8000"

const TIER_ORDER = ["Peak Cinema","Masterpiece","Great Watch","Mid","Skip"]
const TIER_COLORS = {
  "Peak Cinema":"#C8821A","Masterpiece":"#D4A017",
  "Great Watch":"#2D9CDB","Mid":"#8A7560","Skip":"#8B4513"
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"10px", padding:"16px 20px", textAlign:"center", flex:1, minWidth:"100px",
    }}>
      <div style={{ fontSize:"26px", fontWeight:700, color:"var(--accent2)", lineHeight:1, marginBottom:"6px" }}>
        {value ?? 0}
      </div>
      <div style={{ fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--muted2)" }}>
        {label}
      </div>
    </div>
  )
}

function TierDistribution({ history = [] }) {
  const counts = TIER_ORDER.reduce((acc, t) => {
    acc[t] = (history || []).filter(h => h.tier === t).length
    return acc
  }, {})
  const max = Math.max(...Object.values(counts), 1)

  return (
    <div style={{ marginBottom:"32px" }}>
      <p style={{ fontSize:"10px", letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--accent3)", marginBottom:"14px" }}>
        Rating breakdown
      </p>
      {TIER_ORDER.map(t => (
        <div key={t} style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
          <span style={{ fontSize:"12px", color:"var(--muted)", minWidth:"90px" }}>{t}</span>
          <div style={{ flex:1, height:"6px", background:"var(--border)", borderRadius:"3px", overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${(counts[t]/max)*100}%`,
              background: TIER_COLORS[t], borderRadius:"3px", transition:"width 0.6s ease",
            }}/>
          </div>
          <span style={{ fontSize:"11px", color:"var(--muted2)", minWidth:"20px", textAlign:"right" }}>
            {counts[t]}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Profile({ user, onBack, onUserUpdated }) {
  const [data,        setData]        = useState(null)
  const [localUser,   setLocalUser]   = useState(user)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  function handleAvatarUpdated(updated) {
    setLocalUser(updated)
    onUserUpdated?.(updated)
  }

  useEffect(() => {
    if (!user?.id) return
    fetch(`${API}/users/${user.id}/history`)
      .then(r => r.ok ? r.json() : Promise.reject("Failed to load"))
      .then(d => setData(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [user?.id])

  const history  = data?.history  ?? []
  const profile  = localUser
  const reviewed = history.filter(h => h.review).length

  const topTier = history.length
    ? TIER_ORDER.reduce((best, t) => {
        const count = history.filter(h => h.tier === t).length
        return count > (history.filter(h => h.tier === best).length) ? t : best
      }, TIER_ORDER[0])
    : null

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      {/* Header */}
      <div style={{
        padding:"20px 40px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", gap:"20px",
        background:"var(--surface)", flexWrap:"nowrap", overflow:"hidden",
      }}>
        <button onClick={onBack} style={{
          background:"transparent", border:"1px solid var(--border)", borderRadius:"6px",
          padding:"6px 12px", fontSize:"11px", color:"var(--muted)", cursor:"pointer",
          letterSpacing:"0.08em", flexShrink:0,
        }}>← Back</button>
        <div style={{ width:80, height:80, flexShrink:0, position:"relative" }}>
          <AvatarUpload user={localUser} onUpdated={handleAvatarUpdated} showButton={false} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <h2 style={{ fontSize:"20px", fontWeight:700, color:"var(--accent2)", fontFamily:"Georgia, serif", lineHeight:1 }}>
            {profile?.name ?? ""}
          </h2>
          {profile?.email && (
            <p style={{ fontSize:"12px", color:"var(--muted2)", marginTop:"3px" }}>{profile.email}</p>
          )}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"8px", marginTop:"6px",
            padding:"4px 10px", background:"var(--sand2)", border:"1px solid var(--border)", borderRadius:"6px",
          }}>
            <span style={{ fontSize:"11px", color:"var(--muted2)", letterSpacing:"0.06em" }}>User ID</span>
            <span style={{ fontSize:"13px", fontWeight:700, color:"var(--accent2)", fontFamily:"monospace" }}>
              #{profile?.id}
            </span>
            <span style={{ fontSize:"10px", color:"var(--muted2)" }}>— save this to log back in</span>
          </div>
        </div>
      </div>

      <div style={{ padding:"40px", maxWidth:"900px", margin:"0 auto" }}>
        {loading && <p style={{ color:"var(--muted2)", fontSize:"14px" }}>Loading your history…</p>}
        {error   && <div style={{ padding:"12px 16px", background:"#FDE8E2", borderRadius:"8px", color:"#8B4513", fontSize:"13px" }}>⚠ {error}</div>}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div style={{ display:"flex", gap:"12px", marginBottom:"32px", flexWrap:"wrap" }}>
              <StatCard label="Films rated"     value={history.length} />
              <StatCard label="Reviews written" value={reviewed} />
              <StatCard label="Favourite tier"  value={topTier?.split(" ")[0] ?? "—"} />
            </div>

            {history.length > 0 && <TierDistribution history={history} />}

            {/* History label */}
            <p style={{ fontSize:"10px", letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--accent3)", marginBottom:"16px" }}>
              Rating history
            </p>

            {history.length === 0 ? (
              <div style={{ padding:"48px", textAlign:"center", color:"var(--muted2)", fontSize:"14px" }}>
                No ratings yet. Go find your Peak Cinema moment.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {history.map((h, i) => (
                  <div key={h.rating_id ?? i} style={{
                    background:"var(--surface)", border:"1px solid var(--border)",
                    borderRadius:"10px", padding:"16px 20px",
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px", flexWrap:"wrap", gap:"8px" }}>
                      <div>
                        <div style={{ fontSize:"15px", fontWeight:600, color:"var(--accent2)", marginBottom:"4px" }}>
                          {h.title ?? `Movie ${h.movie_id}`}
                          {h.release_year && (
                            <span style={{ fontSize:"12px", color:"var(--muted2)", fontWeight:400, marginLeft:"8px" }}>
                              {h.release_year}
                            </span>
                          )}
                        </div>
                        <GenreChipList chips={h.genre_chips ?? []} size="sm" />
                      </div>
                      <TierBadge tier={h.tier} size="sm" />
                    </div>
                    {h.review && (
                      <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.65, marginTop:"10px", paddingTop:"10px", borderTop:"1px solid var(--border)", fontStyle:"italic" }}>
                        "{h.review}"
                      </p>
                    )}
                    <p style={{ fontSize:"10px", color:"var(--muted2)", marginTop:"8px", letterSpacing:"0.04em" }}>
                      Rated {h.rated_at ? new Date(h.rated_at).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}