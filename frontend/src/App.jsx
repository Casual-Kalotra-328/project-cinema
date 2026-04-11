import RecommendationCard from "./components/RecommendationCard"

const MOCK_RECS = [
  {
    movie_id:        1,
    title:           "The Dark Knight (2008)",
    release_year:    2008,
    predicted_tier:  "Peak Cinema",
    tier_icon:       "🔥",
    tier_color:      "#C8821A",
    hybrid_score:    0.97,
    genre_chips: [
      { name: "Action",  icon: "⚡", color: "#E8712A" },
      { name: "Thriller",icon: "👁",  color: "#8B0000" },
      { name: "Crime",   icon: "⦿",  color: "#2C2C2C" },
    ],
    match_reason:    "Critics rate it highly · high-tension narrative",
    llm_explanation: "Given your love for complex thrillers like Inception and dark crime stories like Se7en, The Dark Knight is absolutely perfect for you. This isn't just a superhero movie but a masterful crime thriller that delivers the same psychological depth and moral complexity you clearly appreciate, with Heath Ledger's Joker creating one of cinema's most chilling antagonists.",
    shap_factors: [
      { feature: "avg_rating",      label: "Critics avg",      direction: "up",   pct: 34 },
      { feature: "user_avg_rating", label: "Your avg rating",  direction: "up",   pct: 28 },
      { feature: "rating_count",    label: "Popularity",       direction: "up",   pct: 18 },
      { feature: "release_year",    label: "Release year",     direction: "down", pct: 8  },
    ],
  },
  {
    movie_id:        2,
    title:           "Parasite (2019)",
    release_year:    2019,
    predicted_tier:  "Masterpiece",
    tier_icon:       "✦",
    tier_color:      "#D4A017",
    hybrid_score:    0.82,
    genre_chips: [
      { name: "Drama",   icon: "🎭", color: "#1A5A8A" },
      { name: "Thriller",icon: "👁",  color: "#8B0000" },
      { name: "Crime",   icon: "⦿",  color: "#2C2C2C" },
    ],
    match_reason:    "Matches your taste profile · strong dramatic storytelling",
    llm_explanation: "Parasite is a masterclass in genre-blending that should resonate deeply with your appreciation for psychological complexity. Bong Joon-ho weaves dark comedy, thriller, and social commentary into something completely singular.",
    shap_factors: [
      { feature: "user_avg_rating", label: "Your avg rating",  direction: "up",   pct: 30 },
      { feature: "avg_rating",      label: "Critics avg",      direction: "up",   pct: 26 },
      { feature: "Drama",           label: "Drama",            direction: "up",   pct: 20 },
      { feature: "rating_std",      label: "Rating consistency",direction: "up",  pct: 12 },
    ],
  },
  {
    movie_id:        3,
    title:           "Rear Window (1954)",
    release_year:    1954,
    predicted_tier:  "Great Watch",
    tier_icon:       "◎",
    tier_color:      "#2D9CDB",
    hybrid_score:    0.71,
    genre_chips: [
      { name: "Mystery", icon: "◉",  color: "#2C5F6E" },
      { name: "Thriller",icon: "👁",  color: "#8B0000" },
      { name: "Romance", icon: "♡",  color: "#E8436A" },
    ],
    match_reason:    "Loved by a large audience · high-tension narrative",
    llm_explanation: "Hitchcock's masterpiece of suspense is a pure exercise in tension that fans of psychological thrillers consistently adore. If you enjoy films that keep you guessing through clever storytelling rather than action, this is essential viewing.",
    shap_factors: [
      { feature: "avg_rating",      label: "Critics avg",      direction: "up",   pct: 32 },
      { feature: "rating_count",    label: "Popularity",       direction: "up",   pct: 22 },
      { feature: "Thriller",        label: "Thriller",         direction: "up",   pct: 16 },
      { feature: "release_year",    label: "Release year",     direction: "down", pct: 14 },
    ],
  },
]

export default function App() {
  return (
    <div style={{
      minHeight:  "100vh",
      background: "var(--bg)",
      padding:    "48px 40px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "48px" }}>
        <p style={{
          fontSize:      "11px",
          letterSpacing: "0.25em",
          color:         "var(--muted)",
          textTransform: "uppercase",
          marginBottom:  "8px"
        }}>
          Recommended for you
        </p>
        <h1 style={{
          fontSize:      "32px",
          fontWeight:    700,
          color:         "var(--accent2)",
          letterSpacing: "-0.01em",
          marginBottom:  "8px"
        }}>
          Your Top 3 Picks
        </h1>
        <p style={{
          fontSize:  "14px",
          color:     "var(--muted)",
          lineHeight: 1.6
        }}>
          Powered by collaborative filtering + content-based ML,
          explained by Claude.
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display:   "flex",
        gap:       "20px",
        alignItems:"flex-start",
        flexWrap:  "wrap",
      }}>
        {MOCK_RECS.map((rec, i) => (
          <RecommendationCard
            key={rec.movie_id}
            rec={rec}
            rank={i + 1}
            delay={i * 120}
          />
        ))}
      </div>
    </div>
  )
}