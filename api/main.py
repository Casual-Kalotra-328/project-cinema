# ============================================================
#  api/main.py
#  Project Cinema — FastAPI Backend
#  Serves recommendations, handles ratings, calls LLM
#  Run: uvicorn api.main:app --reload
# ============================================================

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml.features  import load_raw, build_master, build_movie_meta, DATA_DIR
from ml.predict   import load_models, get_top_n, get_recs_by_genres
from ml.evaluate  import load_rf, explain_movie
from ml.llm       import build_card_explanation

# ── App state — loaded once at startup ───────────────────────
state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models and data once when the server starts."""
    print("Loading data and models...")
    data            = load_raw(DATA_DIR)
    state["data"]   = data
    state["df"]     = build_master(data)
    state["movies"] = build_movie_meta(data["movies"])
    state["models"] = load_models()
    state["rf"]     = load_rf()
    print("✓ Ready")
    yield
    state.clear()

app = FastAPI(
    title       = "Project Cinema API",
    description = "ML-powered movie recommendations with LLM explanations",
    version     = "1.0.0",
    lifespan    = lifespan,
)

# Allow React dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)


# ── Request / Response Models ─────────────────────────────────

class RecommendRequest(BaseModel):
    user_id:      int | None  = None
    genres:       list[str]   = []
    natural_query:str | None  = None
    n:            int         = 3

class RatingSubmit(BaseModel):
    user_id:  int
    movie_id: int
    rating:   float
    review:   str | None = None


# ── Routes ────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name":    "Project Cinema API",
        "version": "1.0.0",
        "status":  "running"
    }


@app.get("/health")
def health():
    return {
        "status":  "ok",
        "models":  list(state.get("models", {}).keys()),
        "ratings": len(state["data"]["ratings"]) if "data" in state else 0,
    }


@app.post("/recommendations")
def recommendations(req: RecommendRequest):
    """
    Main endpoint. Returns top-N recommendation cards
    with tier, genre chips, SHAP factors, and LLM explanation.

    - If user_id provided → hybrid SVD+RF recs
    - If genres provided  → content-based cold-start recs
    - If natural_query    → parse intent then recommend
    """
    models  = state["models"]
    df      = state["df"]
    movies  = state["movies"]
    ratings = state["data"]["ratings"]
    rf      = state["rf"]

    # Parse natural language query if provided
    if req.natural_query:
        from ml.llm import parse_user_intent
        intent = parse_user_intent(req.natural_query)
        genres = intent.get("genres", req.genres)
    else:
        genres = req.genres

    # Get raw recommendations
    if req.user_id and req.user_id in ratings.userId.values:
        recs = get_top_n(
            user_id = req.user_id,
            models  = models,
            ratings = ratings,
            df      = df,
            movies  = movies,
            n       = req.n,
        )
    elif genres:
        recs = get_recs_by_genres(
            genre_list = genres,
            models     = models,
            df         = df,
            movies     = movies,
            n          = req.n,
        )
    else:
        # Default — return top rated movies
        recs = get_recs_by_genres(
            genre_list = ["Drama", "Thriller"],
            models     = models,
            df         = df,
            movies     = movies,
            n          = req.n,
        )

    if not recs:
        raise HTTPException(status_code=404, detail="No recommendations found")

    # Get user's top genres for LLM context
    if req.user_id:
        user_ratings = ratings[ratings.userId == req.user_id]
        top_movie_ids = user_ratings.nlargest(5, "rating").movieId.tolist()
        similar = movies[movies.movieId.isin(top_movie_ids)].title.tolist()
        similar = [t.replace(r"\s*\(\d{4}\)$", "") for t in similar]
    else:
        similar = []

    user_genres = genres if genres else ["Drama", "Thriller"]

    # Build full card payload for each rec
    cards = []
    for rec in recs:
        # SHAP explanation
        explanation = explain_movie(
            rf             = rf,
            movie_id       = rec["movie_id"],
            user_id        = req.user_id or -1,
            df             = df,
            predicted_tier = rec["predicted_tier"],
        )

        # LLM explanation
        card = build_card_explanation(
            rec             = rec,
            shap_factors    = explanation["shap_factors"],
            match_reason    = explanation["match_reason"],
            user_top_genres = user_genres,
            similar_movies  = similar[:3],
        )
        cards.append(card)

    return {"recommendations": cards, "count": len(cards)}


@app.get("/recommendations/user/{user_id}")
def recommend_for_user(user_id: int, n: int = 3):
    """Shorthand GET endpoint for a specific user."""
    return recommendations(RecommendRequest(user_id=user_id, n=n))


@app.get("/recommendations/genres")
def recommend_by_genres(genres: str, n: int = 3):
    """Shorthand GET endpoint for genre-based recs.
    genres = comma-separated string e.g. "Drama,Thriller"
    """
    genre_list = [g.strip() for g in genres.split(",")]
    return recommendations(RecommendRequest(genres=genre_list, n=n))


@app.get("/movies/search")
def search_movies(q: str, limit: int = 10):
    """Search movies by title."""
    movies = state["movies"]
    mask   = movies["title"].str.contains(q, case=False, na=False)
    results = movies[mask].head(limit)[[
        "movieId", "title", "genres", "release_year"
    ]].to_dict(orient="records")
    return {"results": results, "count": len(results)}


@app.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    """Get movie metadata by ID."""
    movies = state["movies"]
    row    = movies[movies.movieId == movie_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Movie not found")
    return row.iloc[0].to_dict()


@app.post("/ratings")
def submit_rating(r: RatingSubmit):
    """
    Submit a rating. Stored in memory for now.
    Phase 2: persisted to SQLite.
    """
    # For now just acknowledge — Phase 2 adds persistence
    return {
        "status":   "received",
        "user_id":  r.user_id,
        "movie_id": r.movie_id,
        "rating":   r.rating,
        "tier":     _rating_to_tier(r.rating),
        "message":  "Rating received. Persistence coming in Phase 2."
    }


def _rating_to_tier(r: float) -> str:
    if r >= 4.5: return "Peak Cinema"
    if r >= 3.5: return "Masterpiece"
    if r >= 2.5: return "Great Watch"
    if r >= 1.5: return "Mid"
    return "Skip"