import { useState } from "react"
import RecommendationCard from "./components/RecommendationCard"

const API = "http://localhost:8000"

export default function App() {
  const [recs,    setRecs]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [query,   setQuery]   = useState("")
  const [userId,  setUserId]  = useState("")
  const [mode,    setMode]    = useState("user") // "user" | "genre" | "chat"

  const GENRES = [
    "Action","Comedy","Drama","Romance",
    "Thriller","Sci-Fi","Horror","Animation"
  ]
  const [selectedGenres, setSelectedGenres] = useState([])

  function toggleGenre(g) {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  async function fetchRecs() {
    setLoading(true)
    setError(null)
    setRecs([])

    try {
      let body = { n: 3 }

      if (mode === "user" && userId) {
        body.user_id = parseInt(userId)
      } else if (mode === "genre" && selectedGenres.length) {
        body.genres = selectedGenres
      } else if (mode === "chat" && query) {
        body.natural_query = query
      }

      const res  = await fetch(`${API}/recommendations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail ?? "API error")
      }

      const data = await res.json()
      setRecs(data.recommendations)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 40px" }}>

      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <p style={{
          fontSize: "11px", letterSpacing: "0.25em",
          color: "var(--muted)", textTransform: "uppercase", marginBottom: "8px"
        }}>
          Project Cinema
        </p>
        <h1 style={{
          fontSize: "36px", fontWeight: 700,
          color: "var(--accent2)", letterSpacing: "-0.02em", marginBottom: "8px"
        }}>
          What should I watch?
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
          Powered by collaborative filtering + content-based ML, explained by Claude.
        </p>
      </div>

      {/* Mode tabs */}
      <div style={{
        display: "flex", gap: "0",
        borderBottom: "1px solid var(--border)",
        marginBottom: "28px"
      }}>
        {[
          { id: "user",  label: "By User ID" },
          { id: "genre", label: "By Genre"   },
          { id: "chat",  label: "Ask Claude" },
        ].map(t => (
          <button key={t.id} onClick={() => setMode(t.id)} style={{
            padding:       "10px 20px",
            fontSize:      "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background:    "transparent",
            border:        "none",
            borderBottom:  mode === t.id
              ? "2px solid var(--accent2)"
              : "2px solid transparent",
            color:         mode === t.id ? "var(--accent2)" : "var(--muted)",
            fontWeight:    mode === t.id ? 600 : 400,
            cursor:        "pointer",
            marginBottom:  "-1px",
            transition:    "all 0.2s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div style={{ marginBottom: "32px", maxWidth: "600px" }}>

        {mode === "user" && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              type="number"
              placeholder="Enter user ID (1–610)"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              style={{
                flex: 1, padding: "12px 16px", fontSize: "14px",
                background: "var(--sand)", border: "1px solid var(--border)",
                borderRadius: "8px", color: "var(--text)",
                outline: "none",
              }}
            />
          </div>
        )}

        {mode === "genre" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {GENRES.map(g => (
              <button key={g} onClick={() => toggleGenre(g)} style={{
                padding:    "6px 16px",
                fontSize:   "12px",
                borderRadius:"20px",
                border:     `1px solid ${selectedGenres.includes(g)
                  ? "var(--accent2)" : "var(--border)"}`,
                background: selectedGenres.includes(g)
                  ? "var(--accent2)" : "transparent",
                color:      selectedGenres.includes(g)
                  ? "var(--sand)" : "var(--muted)",
                cursor:     "pointer",
                transition: "all 0.2s",
                fontWeight: selectedGenres.includes(g) ? 600 : 400,
              }}>
                {g}
              </button>
            ))}
          </div>
        )}

        {mode === "chat" && (
          <input
            type="text"
            placeholder='e.g. "Something dark and psychological, not too long"'
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchRecs()}
            style={{
              width: "100%", padding: "12px 16px", fontSize: "14px",
              background: "var(--sand)", border: "1px solid var(--border)",
              borderRadius: "8px", color: "var(--text)",
              outline: "none",
            }}
          />
        )}

        {/* Get Recs button */}
        <button
          onClick={fetchRecs}
          disabled={loading}
          style={{
            marginTop:     "16px",
            padding:       "12px 32px",
            fontSize:      "12px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight:    600,
            background:    loading ? "var(--muted2)" : "var(--accent2)",
            color:         "var(--sand)",
            border:        "none",
            borderRadius:  "8px",
            cursor:        loading ? "not-allowed" : "pointer",
            transition:    "background 0.2s",
          }}
        >
          {loading ? "Finding your films..." : "Get Recommendations →"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", marginBottom: "24px",
          background: "#FDE8E2", border: "1px solid #8B451360",
          borderRadius: "8px", color: "#8B4513", fontSize: "13px"
        }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          display: "flex", gap: "20px", flexWrap: "wrap"
        }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              flex: i === 1 ? "1.3" : "1", minWidth: "260px",
              height: "400px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "12px",
              opacity: 0.5,
              animation: "pulse-glow 1.5s ease infinite",
            }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && recs.length > 0 && (
        <>
          <div style={{ marginBottom: "24px" }}>
            <p style={{
              fontSize: "11px", letterSpacing: "0.2em",
              color: "var(--accent3)", textTransform: "uppercase"
            }}>
              Your top {recs.length} picks
            </p>
          </div>
          <div style={{
            display: "flex", gap: "20px",
            alignItems: "flex-start", flexWrap: "wrap"
          }}>
            {recs.map((rec, i) => (
              <RecommendationCard
                key={rec.movie_id}
                rec={rec}
                rank={i + 1}
                delay={i * 120}
              />
            ))}
          </div>
        </>
      )}

    </div>
  )
}