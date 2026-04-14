// ============================================================
//  RateModal.jsx
//  Modal for rating a movie + optional review
//  Props:
//    movie    — { movie_id, title, genre_chips }
//    userId   — current user ID
//    onClose  — callback to close modal
//    onSaved  — callback after successful save
// ============================================================

import { useState } from "react"
import TierBadge from "./TierBadge"
import { GenreChipList } from "./GenreChip"

const API = "http://localhost:8000"

const TIERS = [
  { label: "Peak Cinema", value: 5.0,  icon: "🔥" },
  { label: "Masterpiece", value: 4.0,  icon: "✦"  },
  { label: "Great Watch", value: 3.0,  icon: "◎"  },
  { label: "Mid",         value: 2.0,  icon: "—"  },
  { label: "Skip",        value: 1.0,  icon: "✕"  },
]

const TIER_COLORS = {
  "Peak Cinema": { color: "#C8821A", bg: "#FEF3E2", border: "rgba(200,130,26,0.35)" },
  "Masterpiece": { color: "#D4A017", bg: "#FEFBE2", border: "rgba(212,160,23,0.35)" },
  "Great Watch": { color: "#2D9CDB", bg: "#E2F3FE", border: "rgba(45,156,219,0.35)" },
  "Mid":         { color: "#8A7560", bg: "#F0EDE8", border: "rgba(138,117,96,0.35)" },
  "Skip":        { color: "#8B4513", bg: "#FDE8E2", border: "rgba(139,69,19,0.35)"  },
}

export default function RateModal({ movie, userId, onClose, onSaved }) {
  const [selected, setSelected] = useState(null)
  const [review,   setReview]   = useState("")
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState(null)

  // Clean title
  const title = movie.title?.replace(/\s*\(\d{4}\)\s*/g, "").trim()

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/ratings`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          user_id:  userId,
          movie_id: movie.movie_id,
          rating:   selected.value,
          review:   review.trim() || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setSaved(true)
      setTimeout(() => {
        onSaved?.({ movie, tier: selected.label, review })
        onClose()
      }, 1200)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position:        "fixed",
        inset:           0,
        background:      "rgba(26,18,8,0.55)",
        zIndex:          100,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "20px",
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   "var(--surface)",
          border:       "1px solid var(--border2)",
          borderRadius: "14px",
          padding:      "32px",
          width:        "100%",
          maxWidth:     "460px",
          position:     "relative",
        }}
      >
        {/* Close */}
        <button onClick={onClose} style={{
          position:   "absolute",
          top:        "16px",
          right:      "16px",
          background: "transparent",
          border:     "none",
          fontSize:   "18px",
          color:      "var(--muted2)",
          cursor:     "pointer",
          lineHeight: 1,
        }}>✕</button>

        {/* Movie info */}
        <p style={{
          fontSize:      "10px",
          letterSpacing: "0.2em",
          color:         "var(--accent3)",
          textTransform: "uppercase",
          marginBottom:  "6px",
        }}>
          Rate this film
        </p>
        <h2 style={{
          fontSize:     "20px",
          fontWeight:   700,
          color:        "var(--accent2)",
          fontFamily:   "Georgia, serif",
          marginBottom: "10px",
          lineHeight:   1.2,
        }}>
          {title}
        </h2>
        <div style={{ marginBottom: "24px" }}>
          <GenreChipList chips={movie.genre_chips ?? []} size="sm" />
        </div>

        {/* Tier selector */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{
            fontSize:      "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color:         "var(--muted2)",
            marginBottom:  "12px",
          }}>
            Your rating
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {TIERS.map(t => {
              const meta    = TIER_COLORS[t.label]
              const isSelected = selected?.label === t.label
              return (
                <button key={t.label} onClick={() => setSelected(t)} style={{
                  display:       "flex",
                  alignItems:    "center",
                  gap:           "12px",
                  padding:       "12px 16px",
                  borderRadius:  "8px",
                  border:        `1px solid ${isSelected ? meta.border : "var(--border)"}`,
                  background:    isSelected ? meta.bg : "transparent",
                  cursor:        "pointer",
                  transition:    "all 0.15s",
                  textAlign:     "left",
                }}>
                  <span style={{ fontSize: "18px", lineHeight: 1, minWidth: "24px" }}>
                    {t.icon}
                  </span>
                  <span style={{
                    fontSize:   "13px",
                    fontWeight: isSelected ? 600 : 400,
                    color:      isSelected ? meta.color : "var(--text2)",
                  }}>
                    {t.label}
                  </span>
                  {isSelected && (
                    <span style={{
                      marginLeft: "auto",
                      fontSize:   "11px",
                      color:      meta.color,
                    }}>✓ selected</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Review input */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{
            fontSize:      "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color:         "var(--muted2)",
            marginBottom:  "8px",
          }}>
            Review <span style={{ opacity: 0.5 }}>(optional)</span>
          </p>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="What did you think? Be honest..."
            rows={3}
            style={{
              width:       "100%",
              padding:     "10px 14px",
              fontSize:    "13px",
              background:  "var(--sand)",
              border:      "1px solid var(--border)",
              borderRadius:"8px",
              color:       "var(--text)",
              outline:     "none",
              resize:      "none",
              lineHeight:  1.6,
              fontFamily:  "inherit",
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding:      "8px 12px",
            marginBottom: "16px",
            background:   "#FDE8E2",
            border:       "1px solid rgba(139,69,19,0.3)",
            borderRadius: "6px",
            color:        "#8B4513",
            fontSize:     "12px",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!selected || saving || saved}
          style={{
            width:         "100%",
            padding:       "12px",
            fontSize:      "12px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight:    600,
            background:    saved
              ? "#3B6D11"
              : !selected || saving
                ? "var(--muted2)"
                : "var(--accent2)",
            color:         "var(--sand)",
            border:        "none",
            borderRadius:  "8px",
            cursor:        !selected || saving || saved ? "not-allowed" : "pointer",
            transition:    "background 0.2s",
          }}
        >
          {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Rating →"}
        </button>
      </div>
    </div>
  )
}