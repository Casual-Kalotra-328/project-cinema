// ============================================================
//  MovieSearch.jsx
//  Search any movie and rate it directly
//  Props:
//    userId   — current user ID
//    onRated  — callback after rating saved
// ============================================================

import { useState, useRef, useEffect } from "react"
import { GenreChipList } from "./GenreChip"
import RateModal from "./RateModal"

const API = "http://localhost:8000"

function SearchResult({ movie, onRate }) {
  return (
    <div
      onClick={() => onRate(movie)}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "12px",
        padding:      "12px 16px",
        cursor:       "pointer",
        borderBottom: "1px solid var(--border)",
        transition:   "background 0.15s",
        background:   "var(--surface)",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
      onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}
    >
      {/* Poster or placeholder */}
      <div style={{
        width:        44,
        height:       64,
        borderRadius: "4px",
        background:   "var(--sand2)",
        border:       "1px solid var(--border)",
        flexShrink:   0,
        overflow:     "hidden",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
      }}>
        {movie.poster ? (
          <img src={movie.poster} alt={movie.title}
            style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        ) : (
          <span style={{ fontSize:"18px", opacity:0.3 }}>🎬</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:     "14px",
          fontWeight:   600,
          color:        "var(--accent2)",
          marginBottom: "3px",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}>
          {movie.title}
          {movie.release_year && (
            <span style={{ fontSize:"12px", color:"var(--muted2)", fontWeight:400, marginLeft:"6px" }}>
              {movie.release_year}
            </span>
          )}
        </div>
        {movie.genre_chips?.length > 0 && (
          <GenreChipList chips={movie.genre_chips.slice(0,3)} size="sm" />
        )}
        {movie.source === "tmdb" && movie.overview && (
          <p style={{
            fontSize:"11px", color:"var(--muted2)", marginTop:"4px",
            overflow:"hidden", display:"-webkit-box",
            WebkitLineClamp:2, WebkitBoxOrient:"vertical",
          }}>
            {movie.overview}
          </p>
        )}
      </div>

      {/* Source badge + rate hint */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
        <span style={{
          fontSize:"9px", letterSpacing:"0.12em", textTransform:"uppercase",
          color: movie.source === "tmdb" ? "var(--blue2)" : "var(--accent3)",
          background: movie.source === "tmdb" ? "rgba(30,120,180,0.1)" : "rgba(200,130,26,0.1)",
          padding:"2px 6px", borderRadius:"4px",
        }}>
          {movie.source === "tmdb" ? "TMDB" : "ML"}
        </span>
        <span style={{ fontSize:"10px", color:"var(--muted2)" }}>Rate →</span>
      </div>
    </div>
  )
}

export default function MovieSearch({ userId, onRated }) {
  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [rateMovie, setRateMovie] = useState(null)
  const debounce = useRef(null)
  const wrapRef  = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API}/search?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        const r = data.results ?? []
        setResults(r)
        setOpen(r.length > 0)
      } catch(e) { console.error("Search error:", e) }
      finally { setLoading(false) }
    }, 350)
  }

  function handleRate(movie) {
    setOpen(false)
    setRateMovie(movie)
  }

  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%", maxWidth:"560px" }}>
      {/* Search input */}
      <div style={{ position:"relative" }}>
        <input
          type="text"
          placeholder="Search any movie to rate it..."
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          style={{
            width:        "100%",
            padding:      "11px 40px 11px 16px",
            fontSize:     "14px",
            background:   "var(--sand)",
            border:       "1px solid var(--border)",
            borderRadius: open && results.length > 0 ? "8px 8px 0 0" : "8px",
            color:        "var(--text)",
            outline:      "none",
            transition:   "border-radius 0.1s",
          }}
        />
        <span style={{
          position:  "absolute",
          right:     "14px",
          top:       "50%",
          transform: "translateY(-50%)",
          fontSize:  "14px",
          opacity:   0.4,
          pointerEvents: "none",
        }}>
          {loading ? "⟳" : "⌕"}
        </span>
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div style={{
          position:    "absolute",
          top:         "100%",
          left:        0,
          right:       0,
          background:  "var(--surface)",
          border:      "1px solid var(--border)",
          borderTop:   "none",
          borderRadius:"0 0 8px 8px",
          zIndex:      50,
          maxHeight:   "400px",
          overflowY:   "auto",
          boxShadow:   "0 8px 24px rgba(26,18,8,0.12)",
        }}>
          {results.map((movie, i) => (
            <SearchResult key={`${movie.source}-${movie.movie_id}-${i}`}
              movie={movie} onRate={handleRate} />
          ))}
        </div>
      )}

      {/* Rate modal */}
      {rateMovie && (
        <RateModal
          movie={rateMovie}
          userId={userId}
          onClose={() => { setRateMovie(null); setQuery(""); setResults([]) }}
          onSaved={(data) => {
            setRateMovie(null)
            setQuery("")
            setResults([])
            onRated?.(data)
          }}
        />
      )}
    </div>
  )
}