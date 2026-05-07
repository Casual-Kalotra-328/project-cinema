import { useState, useEffect } from "react"
import RecommendationCard from "./components/RecommendationCard"
import RateModal          from "./components/RateModal"
import UserSetup          from "./components/UserSetup"
import Profile            from "./pages/Profile"
import { Avatar }         from "./components/AvatarUpload"
import MovieSearch        from "./components/MovieSearch"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

const GENRES = ["Action","Comedy","Drama","Romance","Thriller","Sci-Fi","Horror","Animation"]

function SkeletonCard({ featured }) {
  return (
    <div style={{
      flex:featured?"1.3":"1", minWidth:"260px", height:"480px",
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"14px", overflow:"hidden", position:"relative",
    }}>
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
        animation:"shimmer 1.6s ease infinite",
      }}/>
      {[80,140,60,100,200,160].map((w,i)=>(
        <div key={i} style={{
          height:i===1?"22px":"12px", width:`${w}px`,
          background:"var(--border)", borderRadius:"4px",
          marginBottom:"14px", margin:"20px 20px 0", opacity:0.5,
        }}/>
      ))}
    </div>
  )
}

function LumiereNav({ user, onProfile, onLogout }) {
  return (
    <nav style={{
      padding:"1rem 40px", borderBottom:"1px solid var(--border)",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      background:"rgba(232,213,163,0.85)", backdropFilter:"blur(12px)",
      position:"sticky", top:0, zIndex:10,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
          <polygon points="14,10 6,0 10,0"  fill="#C8821A" opacity="0.3"/>
          <polygon points="14,10 11,0 17,0" fill="#D4A017" opacity="0.4"/>
          <polygon points="14,10 18,0 22,0" fill="#C8821A" opacity="0.3"/>
          <circle cx="14" cy="17" r="10" fill="none" stroke="#8A5208" strokeWidth="1.8"/>
          <circle cx="14" cy="17" r="2.5" fill="#8A5208"/>
          <line x1="14" y1="14.5" x2="14" y2="9"  stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="14" y1="19.5" x2="14" y2="25" stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="11.5" y1="17" x2="6"  y2="17" stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="16.5" y1="17" x2="22" y2="17" stroke="#8A5208" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="14" cy="7"  r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
          <circle cx="14" cy="27" r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
          <circle cx="4"  cy="17" r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
          <circle cx="24" cy="17" r="1.5" fill="#E8D5A3" stroke="#8A5208" strokeWidth="1"/>
        </svg>
        <div>
          <div style={{ fontSize:"20px", fontWeight:700, letterSpacing:"0.04em", color:"var(--accent2)", fontFamily:"Georgia, serif", lineHeight:1.5 }}>
            Lumière
          </div>
          <div style={{ fontSize:"8px", letterSpacing:"0.18em", color:"var(--muted2)", textTransform:"uppercase", marginTop:"2px" }}>
            Find peak cinema
          </div>
        </div>
      </div>
      {user && (
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <Avatar user={user} size={32} />
          <span style={{ fontSize:"13px", color:"var(--muted)", letterSpacing:"0.02em" }}>{user.name}</span>
          <button onClick={onProfile} style={{
            padding:"6px 14px", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase",
            background:"transparent", border:"1px solid var(--border2)", borderRadius:"6px",
            color:"var(--muted)", cursor:"pointer",
          }}>Profile</button>
          <button onClick={onLogout} style={{
            padding:"6px 14px", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase",
            background:"transparent", border:"1px solid var(--border)", borderRadius:"6px",
            color:"var(--muted2)", cursor:"pointer",
          }}>Sign out</button>
        </div>
      )}
    </nav>
  )
}

export default function App() {
  const [user,           setUser]           = useState(null)
  const [page,           setPage]           = useState("home")
  const [recs,           setRecs]           = useState([])
  const [tmdbRecs,       setTmdbRecs]       = useState([])
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState(null)
  const [query,          setQuery]          = useState("")
  const [mode,           setMode]           = useState("user")
  const [selectedGenres, setSelectedGenres] = useState([])
  const [hasSearched,    setHasSearched]    = useState(false)
  const [rateMovie,      setRateMovie]      = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem("lumiere_user")
    if (stored) { try { setUser(JSON.parse(stored)) } catch {} }
    else {
      setRecs([])
      setHasSearched(false)
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem("lumiere_user")
    setUser(null); setRecs([]); setTmdbRecs([])
    setHasSearched(false); setError(null)
    setMode("user"); setQuery(""); setSelectedGenres([])
  }
  function toggleGenre(g) { setSelectedGenres(p => p.includes(g) ? p.filter(x=>x!==g) : [...p,g]) }
  function switchMode(m)  { setMode(m); setRecs([]); setTmdbRecs([]); setError(null); setHasSearched(false) }

  const canSearch =
    mode==="user" ||
    (mode==="genre" && selectedGenres.length>0) ||
    (mode==="chat"  && query.trim())

  async function fetchRecs() {
    setLoading(true); setError(null); setRecs([]); setTmdbRecs([]); setHasSearched(true)
    try {
      let body = { n: 3 }
      if (mode==="user")                                body.user_id       = user.id
      else if (mode==="genre" && selectedGenres.length) body.genres        = selectedGenres
      else if (mode==="chat"  && query)                 body.natural_query = query

      const res = await fetch(`${API}/recommendations`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).detail ?? "API error")
      const data = await res.json()
      setRecs(data.recommendations ?? [])
      setTmdbRecs(data.tmdb ?? [])
    } catch(e) { setError(e.message) }
    finally    { setLoading(false) }
  }

  if (!user)            return <UserSetup onComplete={u => setUser(u)} />
  if (page==="profile") return (
    <Profile
      user={user}
      onBack={() => setPage("home")}
      onUserUpdated={u => {
        setUser(u)
        localStorage.setItem("lumiere_user", JSON.stringify(u))
      }}
    />
  )

  const tmdbSectionLabel =
    mode==="user"  ? "Trending picks you might enjoy" :
    mode==="genre" ? `More ${selectedGenres[0] ?? ""} picks from TMDB` :
                     "Trending picks matching your mood"

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <LumiereNav user={user} onProfile={() => setPage("profile")} onLogout={handleLogout} />

      <div style={{ padding:"48px 40px", maxWidth:"1200px", margin:"0 auto" }}>

        <div style={{ marginBottom:"40px" }}>
          <h1 style={{ fontSize:"clamp(28px,4vw,42px)", fontWeight:700, color:"var(--accent2)", letterSpacing:"-0.02em", marginBottom:"10px", lineHeight:1.1, fontFamily:"Georgia, serif" }}>
            What should I watch?
          </h1>
          <p style={{ fontSize:"13px", color:"var(--muted2)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"20px" }}>
            Personalised recommendations · explained by AI
          </p>
          <MovieSearch userId={user.id} onRated={() => {}} />
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:"28px" }}>
          {[{id:"user",label:"For You"},{id:"genre",label:"By Genre"},{id:"chat",label:"Ask Claude"}].map(t=>(
            <button key={t.id} onClick={()=>switchMode(t.id)} style={{
              padding:"10px 20px", fontSize:"11px", letterSpacing:"0.12em", textTransform:"uppercase",
              background:"transparent", border:"none",
              borderBottom: mode===t.id?"2px solid var(--accent2)":"2px solid transparent",
              color: mode===t.id?"var(--accent2)":"var(--muted)",
              fontWeight: mode===t.id?600:400, cursor:"pointer", marginBottom:"-1px", transition:"all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Input area */}
        <div style={{ marginBottom:"28px", maxWidth:"580px" }}>

          {mode==="user" && (
            <div style={{
              padding:"16px 20px", background:"var(--surface)",
              border:"1px solid var(--border)", borderRadius:"8px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}>
              <div>
                <p style={{ fontSize:"13px", color:"var(--text2)", fontWeight:600, marginBottom:"3px" }}>
                  Recommendations for {user.name}
                </p>
                <p style={{ fontSize:"11px", color:"var(--muted2)" }}>
                  Based on your rating history and taste profile
                </p>
              </div>
              <span style={{ fontSize:"11px", color:"var(--accent3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                User #{user.id}
              </span>
            </div>
          )}

          {mode==="genre" && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
              {GENRES.map(g=>(
                <button key={g} onClick={()=>toggleGenre(g)} style={{
                  padding:"6px 16px", fontSize:"12px", borderRadius:"20px",
                  border:`1px solid ${selectedGenres.includes(g)?"var(--accent2)":"var(--border)"}`,
                  background: selectedGenres.includes(g)?"var(--accent2)":"transparent",
                  color: selectedGenres.includes(g)?"var(--sand)":"var(--muted)",
                  cursor:"pointer", transition:"all 0.2s",
                  fontWeight: selectedGenres.includes(g)?600:400,
                }}>{g}</button>
              ))}
            </div>
          )}

          {mode==="chat" && (
            <div>
              <textarea
                placeholder='Describe what you want... e.g. "Something dark and psychological, not too long"'
                value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(canSearch)fetchRecs()} }}
                rows={3} style={{
                  width:"100%", padding:"12px 16px", fontSize:"14px",
                  background:"var(--sand)", border:"1px solid var(--border)",
                  borderRadius:"8px", color:"var(--text)", outline:"none",
                  resize:"none", lineHeight:1.6, fontFamily:"inherit",
                  boxSizing:"border-box",
                }}
              />
              <p style={{ fontSize:"11px", color:"var(--muted2)", marginTop:"5px", letterSpacing:"0.02em" }}>
                Enter to search · Shift+Enter for new line
              </p>
            </div>
          )}

          <button onClick={fetchRecs} disabled={loading||!canSearch} style={{
            marginTop:"16px", padding:"11px 28px", fontSize:"11px",
            letterSpacing:"0.14em", textTransform:"uppercase", fontWeight:600,
            background: loading||!canSearch?"var(--muted2)":"var(--accent2)",
            color:"var(--sand)", border:"none", borderRadius:"8px",
            cursor: loading||!canSearch?"not-allowed":"pointer",
            transition:"background 0.2s", opacity:!canSearch?0.6:1,
          }}>
            {loading?"Finding your films…":"Get Recommendations →"}
          </button>
        </div>

        {error && (
          <div style={{ padding:"12px 16px", marginBottom:"24px", background:"#FDE8E2", border:"1px solid rgba(139,69,19,0.3)", borderRadius:"8px", color:"var(--tier-skip)", fontSize:"13px" }}>
            ⚠ {error}
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <>
            <style>{`
              @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
              @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
              .fade-up { animation: fadeUp 0.5s ease forwards; opacity:0; }
            `}</style>
            <div style={{ display:"flex", gap:"20px", flexWrap:"wrap" }}>
              <SkeletonCard featured/><SkeletonCard/><SkeletonCard/>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && hasSearched && recs.length===0 && !error && (
          <div style={{ padding:"48px", textAlign:"center", color:"var(--muted2)", fontSize:"14px" }}>
            No recommendations found. Try different inputs.
          </div>
        )}

        {/* ML Recommendations */}
        {!loading && recs.length > 0 && (
          <>
            <style>{`
              @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
              .fade-up { animation: fadeUp 0.5s ease forwards; opacity:0; }
            `}</style>

            <p style={{ fontSize:"11px", letterSpacing:"0.2em", color:"var(--accent3)", textTransform:"uppercase", marginBottom:"20px" }}>
              Your top {recs.length} picks
            </p>
            <div style={{ display:"flex", gap:"20px", alignItems:"flex-start", flexWrap:"wrap" }}>
              {recs.map((rec,i) => (
                <RecommendationCard
                  key={rec.movie_id}
                  rec={rec}
                  rank={i+1}
                  delay={i*120}
                  onRate={() => setRateMovie(rec)}
                />
              ))}
            </div>

            {/* TMDB Section — shows for all tabs */}
            {tmdbRecs.length > 0 && (
              <>
                <div style={{
                  display:"flex", alignItems:"center", gap:"16px",
                  margin:"52px 0 32px",
                }}>
                  <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg, var(--border), transparent)" }}/>
                  <span style={{ fontSize:"10px", letterSpacing:"0.2em", color:"var(--blue2)", textTransform:"uppercase", whiteSpace:"nowrap", fontWeight:600 }}>
                    Also worth exploring
                  </span>
                  <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg, transparent, var(--border))" }}/>
                </div>

                <div style={{ marginBottom:"24px" }}>
                  <p style={{ fontSize:"22px", fontWeight:700, color:"var(--accent2)", fontFamily:"Georgia, serif", marginBottom:"6px" }}>
                    {tmdbSectionLabel}
                  </p>
                  <p style={{ fontSize:"12px", color:"var(--muted2)", letterSpacing:"0.04em" }}>
                    Live picks from TMDB · updated daily
                  </p>
                </div>

                <div style={{ display:"flex", gap:"20px", flexWrap:"wrap", alignItems:"flex-start" }}>
                  {tmdbRecs.map((rec, i) => (
                    <RecommendationCard
                      key={rec.movie_id}
                      rec={rec}
                      rank={i+1}
                      delay={i*100}
                      onRate={() => setRateMovie(rec)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {rateMovie && (
        <RateModal
          movie={rateMovie}
          userId={user.id}
          onClose={() => setRateMovie(null)}
          onSaved={() => setRateMovie(null)}
        />
      )}
    </div>
  )
}