# ============================================================
#  api/main.py
#  Project Cinema — FastAPI Backend (Phase 2)
#  Adds user creation, persistent ratings, reviews, history
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

from api.db.database import (
    init_db, create_user, get_user, get_user_by_email,
    save_rating, save_review, get_user_history, get_rating_count
)

# ── App state ─────────────────────────────────────────────────
state = {}

RETRAIN_THRESHOLD = 50  # retrain after every 50 new ratings

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initialising database...")
    init_db()
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
    title       = "Lumière API",
    description = "ML-powered movie recommendations with LLM explanations",
    version     = "2.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)


# ── Request / Response Models ─────────────────────────────────

class RecommendRequest(BaseModel):
    user_id:       int | None = None
    genres:        list[str]  = []
    natural_query: str | None = None
    n:             int        = 3

class UserCreate(BaseModel):
    name:  str
    email: str | None = None

class RatingSubmit(BaseModel):
    user_id:  int
    movie_id: int
    rating:   float
    review:   str | None = None


# ── Health & Root ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name":    "Lumière API",
        "version": "2.0.0",
        "status":  "running"
    }

@app.get("/health")
def health():
    return {
        "status":       "ok",
        "models":       list(state.get("models", {}).keys()),
        "ratings":      len(state["data"]["ratings"]) if "data" in state else 0,
        "db_ratings":   get_rating_count(),
    }


# ── User endpoints ────────────────────────────────────────────

@app.post("/users")
def create_new_user(body: UserCreate):
    """Create a new user. Returns user object with ID."""
    if body.email:
        existing = get_user_by_email(body.email)
        if existing:
            return existing
    user = create_user(body.name, body.email)
    return user

@app.get("/users/by-email")
def get_user_by_email_endpoint(email: str):
    """Look up a user by email for returning user login."""
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")
    return user

@app.get("/users/{user_id}/history")
def get_history(user_id: int):
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    history = get_user_history(user_id)
    movies  = state["movies"]
    from ml.features import get_genre_chips, get_tier_meta
    import re
    enriched = []
    for h in history:
        movie_row = movies[movies.movieId == h["movie_id"]]
        if not movie_row.empty:
            row   = movie_row.iloc[0]
            title = re.sub(r"\s*\(\d{4}\)\s*", " ", row["title"]).strip()
            yr    = re.search(r"\((\d{4})\)", row["title"])
            year  = int(yr.group(1)) if yr else None
            chips = get_genre_chips(row.get("genres", ""))
        else:
            title, year, chips = "Movie {}".format(h["movie_id"]), None, []
        enriched.append({**h, "title": title, "release_year": year,
                         "genre_chips": chips, "tier_meta": get_tier_meta(h["tier"])})
    return {"user": user, "history": enriched, "count": len(enriched)}

@app.get("/users/{user_id}")
def get_user_profile(user_id: int):
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/ratings")
def submit_rating(r: RatingSubmit):
    """
    Save a rating (and optional review) to the database.
    Triggers model retraining every RETRAIN_THRESHOLD ratings.
    """
    # Validate user exists
    user = get_user(r.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate rating value
    if not (0.5 <= r.rating <= 5.0):
        raise HTTPException(
            status_code=422,
            detail="Rating must be between 0.5 and 5.0"
        )

    # Save rating
    rating = save_rating(r.user_id, r.movie_id, r.rating)

    # Save review if provided
    review = None
    if r.review and r.review.strip():
        review = save_review(
            r.user_id, r.movie_id,
            rating["id"], r.review.strip()
        )

    # Check retraining trigger
    total = get_rating_count()
    should_retrain = total % RETRAIN_THRESHOLD == 0

    return {
        "status":         "saved",
        "rating":         rating,
        "review":         review,
        "total_db_ratings": total,
        "retrain_triggered": should_retrain,
    }


# ── Recommendation endpoints ──────────────────────────────────

@app.post("/recommendations")
def recommendations(req: RecommendRequest):
    """
    Main recommendation endpoint.
    Hybrid SVD+RF for known users, content-based for new users,
    intent parsing for natural language queries.
    """
    models  = state["models"]
    df      = state["df"]
    movies  = state["movies"]
    ratings = state["data"]["ratings"]
    rf      = state["rf"]

    if req.natural_query:
        from ml.llm import parse_user_intent
        intent = parse_user_intent(req.natural_query)
        genres = intent.get("genres", req.genres)
    else:
        genres = req.genres

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
        recs = get_recs_by_genres(
            genre_list = ["Drama", "Thriller"],
            models     = models,
            df         = df,
            movies     = movies,
            n          = req.n,
        )

    if not recs:
        raise HTTPException(status_code=404, detail="No recommendations found")

    if req.user_id:
        user_ratings  = ratings[ratings.userId == req.user_id]
        top_ids       = user_ratings.nlargest(5, "rating").movieId.tolist()
        similar       = movies[movies.movieId.isin(top_ids)].title.tolist()
    else:
        similar = []

    user_genres = genres if genres else ["Drama", "Thriller"]

    cards = []
    for rec in recs:
        explanation = explain_movie(
            rf             = rf,
            movie_id       = rec["movie_id"],
            user_id        = req.user_id or -1,
            df             = df,
            predicted_tier = rec["predicted_tier"],
        )
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
    return recommendations(RecommendRequest(user_id=user_id, n=n))

@app.get("/recommendations/genres")
def recommend_by_genres(genres: str, n: int = 3):
    genre_list = [g.strip() for g in genres.split(",")]
    return recommendations(RecommendRequest(genres=genre_list, n=n))


# ── Movie endpoints ───────────────────────────────────────────

@app.get("/movies/search")
def search_movies(q: str, limit: int = 10):
    movies = state["movies"]
    mask   = movies["title"].str.contains(q, case=False, na=False)
    results = movies[mask].head(limit)[[
        "movieId", "title", "genres", "release_year"
    ]].to_dict(orient="records")
    return {"results": results, "count": len(results)}

@app.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    movies  = state["movies"]
    row     = movies[movies.movieId == movie_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Movie not found")
    return row.iloc[0].to_dict()