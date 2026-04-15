# ============================================================
#  api/main.py — Lumière API
#  Run: uvicorn api.main:app --reload
# ============================================================

import os, re
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from ml.features import load_raw, build_master, build_movie_meta, DATA_DIR
from ml.predict  import load_models, get_top_n, get_recs_by_genres
from ml.evaluate import load_rf, explain_movie
from ml.llm      import build_card_explanation
from api.db.database import (
    init_db, create_user, get_user, get_user_by_email,
    save_rating, save_review, get_user_history,
    get_rating_count, update_avatar,
    save_movie_title, get_movie_title
)

RETRAIN_THRESHOLD = 50
TMDB_BASE         = "https://api.themoviedb.org/3"

# ── Helpers ───────────────────────────────────────────────────

def clean_title(t: str) -> str:
    t = re.sub(r"\s*\(\d{4}\)\s*", "", t).strip()
    t = re.sub(r"^(.*),\s*(The|A|An|Les|La|Le|Das|Die|Der)$",
               r"\2 \1", t, flags=re.IGNORECASE)
    return t.strip()

def fetch_poster(tmdb_id) -> str | None:
    import httpx
    token = os.getenv("TMDB_API_KEY", "")
    if not token or not tmdb_id: return None
    try:
        resp = httpx.get(
            f"{TMDB_BASE}/movie/{int(float(str(tmdb_id)))}",
            headers={"Authorization": f"Bearer {token}"},
            params={"language": "en-US"}, timeout=3,
        )
        if resp.status_code == 200:
            path = resp.json().get("poster_path")
            return f"https://image.tmdb.org/t/p/w300{path}" if path else None
    except Exception:
        pass
    return None

def tmdb_suggestions(query: str, genres: list, n: int = 3) -> list:
    import httpx
    token = os.getenv("TMDB_API_KEY", "")
    if not token: return []
    try:
        term = query.strip() if query.strip() else " ".join(genres[:2])
        resp = httpx.get(
            f"{TMDB_BASE}/search/movie",
            headers={"Authorization": f"Bearer {token}"},
            params={"query": term, "include_adult": "false", "page": 1},
            timeout=5,
        )
        if resp.status_code != 200: return []
        cards = []
        for m in resp.json().get("results", []):
            if not m.get("poster_path"): continue
            rd   = m.get("release_date", "")
            year = int(rd[:4]) if rd else None
            cards.append({
                "movie_id":        f"tmdb_{m['id']}",
                "title":           m.get("title", ""),
                "release_year":    year,
                "genres":          "",
                "genre_chips":     [],
                "predicted_tier":  None,
                "tier_icon":       None,
                "tier_color":      "#1E78B4",
                "hybrid_score":    round(m.get("vote_average", 0) / 10, 2),
                "poster":          f"https://image.tmdb.org/t/p/w300{m['poster_path']}",
                "overview":        m.get("overview", "")[:200],
                "match_reason":    "Trending · Highly rated on TMDB",
                "llm_explanation": m.get("overview", "")[:200],
                "shap_factors":    [],
                "source":          "tmdb",
            })
            if len(cards) >= n: break
        return cards
    except Exception as e:
        print(f"TMDB suggestions error: {e}")
        return []

def tmdb_discover(genres: list, n: int = 3) -> list:
    """Fallback: use TMDB discover endpoint when search yields nothing."""
    import httpx
    token = os.getenv("TMDB_API_KEY", "")
    if not token: return []
    GENRE_IDS = {
        "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
        "Crime": 80, "Drama": 18, "Fantasy": 14, "Horror": 27,
        "Romance": 10749, "Sci-Fi": 878, "Thriller": 53,
    }
    ids = [str(GENRE_IDS[g]) for g in genres if g in GENRE_IDS]
    try:
        resp = httpx.get(
            f"{TMDB_BASE}/discover/movie",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "with_genres":        ",".join(ids) if ids else "",
                "sort_by":            "vote_average.desc",
                "vote_count.gte":     500,
                "include_adult":      "false",
                "page":               1,
            },
            timeout=5,
        )
        if resp.status_code != 200: return []
        cards = []
        for m in resp.json().get("results", []):
            if not m.get("poster_path"): continue
            rd   = m.get("release_date", "")
            year = int(rd[:4]) if rd else None
            cards.append({
                "movie_id":        f"tmdb_{m['id']}",
                "title":           m.get("title", ""),
                "release_year":    year,
                "genres":          "",
                "genre_chips":     [],
                "predicted_tier":  None,
                "tier_icon":       None,
                "tier_color":      "#1E78B4",
                "hybrid_score":    round(m.get("vote_average", 0) / 10, 2),
                "poster":          f"https://image.tmdb.org/t/p/w300{m['poster_path']}",
                "overview":        m.get("overview", "")[:200],
                "match_reason":    "Highly rated · Top TMDB pick",
                "llm_explanation": m.get("overview", "")[:200],
                "shap_factors":    [],
                "source":          "tmdb",
            })
            if len(cards) >= n: break
        return cards
    except Exception as e:
        print(f"TMDB discover error: {e}")
        return []

def get_tmdb_picks(query: str, genres: list, n: int = 3) -> list:
    """Try search first, fall back to discover if search returns < n results."""
    picks = tmdb_suggestions(query, genres, n=n)
    if len(picks) < n:
        picks += tmdb_discover(genres, n=n - len(picks))
    return picks[:n]

# ── App ───────────────────────────────────────────────────────

state = {}

@asynccontextmanager
async def lifespan(app):
    init_db()
    data = load_raw(DATA_DIR)
    state["data"]   = data
    state["df"]     = build_master(data)
    state["movies"] = build_movie_meta(data["movies"])
    state["models"] = load_models()
    state["rf"]     = load_rf()
    print("✓ Ready")
    yield
    state.clear()

app = FastAPI(title="Lumière API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Request models ────────────────────────────────────────────

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
    movie_id: str | int
    rating:   float
    review:   str | None = None
    title:    str | None = None
    year:     int | None = None
    poster:   str | None = None

class AvatarUpload(BaseModel):
    avatar: str

# ── Root ──────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"name": "Lumière API", "version": "2.0.0", "status": "running"}

@app.get("/health")
def health():
    return {
        "status":     "ok",
        "models":     list(state.get("models", {}).keys()),
        "ratings":    len(state["data"]["ratings"]) if "data" in state else 0,
        "db_ratings": get_rating_count(),
    }

# ── Users ─────────────────────────────────────────────────────

@app.post("/users")
def create_new_user(body: UserCreate):
    if body.email:
        existing = get_user_by_email(body.email)
        if existing: return existing
    return create_user(body.name, body.email)

@app.get("/users/by-email")
def get_by_email(email: str):
    user = get_user_by_email(email)
    if not user: raise HTTPException(404, "No account found with that email")
    return user

@app.post("/users/{user_id}/avatar")
def upload_avatar(user_id: int, body: AvatarUpload):
    user = get_user(user_id)
    if not user: raise HTTPException(404, "User not found")
    if len(body.avatar) > 2_800_000: raise HTTPException(413, "Image too large")
    return update_avatar(user_id, body.avatar)

@app.get("/users/{user_id}/history")
def get_history(user_id: int):
    user = get_user(user_id)
    if not user: raise HTTPException(404, "User not found")
    history = get_user_history(user_id)
    movies  = state["movies"]
    from ml.features import get_genre_chips, get_tier_meta
    enriched = []
    for h in history:
        row = movies[movies.movieId == h["movie_id"]]
        if not row.empty:
            r      = row.iloc[0]
            title  = clean_title(r["title"])
            yr     = re.search(r"\((\d{4})\)", r["title"])
            year   = int(yr.group(1)) if yr else None
            chips  = get_genre_chips(r.get("genres", ""))
            poster = None
        else:
            saved  = get_movie_title(h["movie_id"])
            title  = saved["title"]  if saved else f"Movie {h['movie_id']}"
            year   = saved["year"]   if saved else None
            poster = saved["poster"] if saved else None
            chips  = []
        enriched.append({**h, "title": title, "release_year": year,
                         "genre_chips": chips, "poster": poster,
                         "tier_meta": get_tier_meta(h["tier"])})
    return {"user": user, "history": enriched, "count": len(enriched)}

@app.get("/users/{user_id}")
def get_user_profile(user_id: int):
    user = get_user(user_id)
    if not user: raise HTTPException(404, "User not found")
    return user

# ── Ratings ───────────────────────────────────────────────────

@app.post("/ratings")
def submit_rating(r: RatingSubmit):
    user = get_user(r.user_id)
    if not user: raise HTTPException(404, "User not found")
    if not (0.5 <= r.rating <= 5.0): raise HTTPException(422, "Rating must be 0.5–5.0")
    mid = (-(int(str(r.movie_id).replace("tmdb_", "")))
           if str(r.movie_id).startswith("tmdb_") else int(r.movie_id))
    if r.title:
        save_movie_title(mid, r.title, r.year, r.poster)
    rating = save_rating(r.user_id, mid, r.rating)
    review = (save_review(r.user_id, mid, rating["id"], r.review.strip())
              if r.review and r.review.strip() else None)
    total  = get_rating_count()
    return {"status": "saved", "rating": rating, "review": review,
            "total_db_ratings": total,
            "retrain_triggered": total % RETRAIN_THRESHOLD == 0}

# ── Recommendations ───────────────────────────────────────────

@app.post("/recommendations")
def recommendations(req: RecommendRequest):
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

    # ── Pull user's DB history to personalise everything ──────
    db_history   = get_user_history(req.user_id) if req.user_id else []
    top_rated    = [h for h in db_history if h["tier"] in ("Peak Cinema", "Masterpiece")]
    top_ids      = [h["movie_id"] for h in top_rated][:5]
    similar      = [re.sub(r"\s*\(\d{4}\)\s*", "", t).strip()
                    for t in movies[movies.movieId.isin(top_ids)].title.tolist()]

    # Derive user's favourite genres from their rating history
    from ml.features import get_genre_chips
    history_genres: list[str] = []
    if db_history:
        from collections import Counter
        genre_counter: Counter = Counter()
        for h in top_rated:
            row = movies[movies.movieId == h["movie_id"]]
            if not row.empty:
                for chip in get_genre_chips(row.iloc[0].get("genres", "")):
                    genre_counter[chip["name"]] += 1
        history_genres = [g for g, _ in genre_counter.most_common(3)]

    # ── Get ML recs ───────────────────────────────────────────
    if req.user_id and req.user_id in ratings.userId.values:
        recs = get_top_n(req.user_id, models, ratings, df, movies, n=req.n)
    elif genres:
        recs = get_recs_by_genres(genres, models, df, movies, n=req.n)
    else:
        # Cold start: use genres derived from DB history if available
        fallback = history_genres if history_genres else ["Drama", "Thriller"]
        recs = get_recs_by_genres(fallback, models, df, movies, n=req.n)

    if not recs: raise HTTPException(404, "No recommendations found")

    # ── Exclude movies the user already rated ─────────────────
    rated_ids = {h["movie_id"] for h in db_history}
    recs = [r for r in recs if r["movie_id"] not in rated_ids] or recs

    # ── Fetch posters ─────────────────────────────────────────
    links_df = state["data"]["links"]
    for rec in recs:
        rec["title"] = clean_title(rec.get("title", ""))
        try:
            row     = links_df[links_df.movieId == rec["movie_id"]]
            tmdb_id = row.iloc[0].get("tmdbId") if not row.empty else None
            rec["poster"] = fetch_poster(tmdb_id)
        except Exception:
            rec["poster"] = None

    # ── Build LLM cards ───────────────────────────────────────
    user_genres = genres if genres else (history_genres if history_genres else ["Drama", "Thriller"])

    cards = []
    for rec in recs:
        exp  = explain_movie(rf=rf, movie_id=rec["movie_id"],
                             user_id=req.user_id or -1, df=df,
                             predicted_tier=rec["predicted_tier"])
        card = build_card_explanation(rec=rec,
                                      shap_factors=exp["shap_factors"],
                                      match_reason=exp["match_reason"],
                                      user_top_genres=user_genres,
                                      similar_movies=similar)
        cards.append(card)

    # ── TMDB picks — one card per seed title for variety ─────
    tmdb: list = []
    if req.natural_query:
        tmdb = get_tmdb_picks(req.natural_query, user_genres, n=3)
    else:
        # Build 3 different seed titles so each TMDB card is distinct
        seeds: list[str] = []
        if similar:
            seeds += similar[:3]
        if len(seeds) < 3:
            seeds += [c["title"] for c in cards if c["title"] not in seeds]
        if len(seeds) < 3:
            seeds += user_genres

        seen_ids: set = set()
        for seed in seeds[:3]:
            picks = tmdb_suggestions(seed, user_genres, n=1)
            for p in picks:
                if p["movie_id"] not in seen_ids:
                    seen_ids.add(p["movie_id"])
                    tmdb.append(p)
                    break

        # Top up with discover if we still don't have 3
        if len(tmdb) < 3:
            extras = tmdb_discover(user_genres, n=3)
            for e in extras:
                if e["movie_id"] not in seen_ids and len(tmdb) < 3:
                    tmdb.append(e)

    return {
        "recommendations": cards,
        "count":           len(cards),
        "tmdb":            tmdb,
    }

@app.get("/recommendations/user/{user_id}")
def recommend_for_user(user_id: int, n: int = 3):
    return recommendations(RecommendRequest(user_id=user_id, n=n))

@app.get("/recommendations/genres")
def recommend_by_genres(genres: str, n: int = 3):
    return recommendations(RecommendRequest(
        genres=[g.strip() for g in genres.split(",")], n=n))

# ── Search ────────────────────────────────────────────────────

@app.get("/search")
def search(q: str, limit: int = 8):
    import httpx
    token   = os.getenv("TMDB_API_KEY", "")
    movies  = state["movies"]
    results = []

    links_df = state["data"]["links"]
    mask = movies["title"].str.contains(q, case=False, na=False)
    for _, row in movies[mask].head(4).iterrows():
        title = row["title"]
        yr    = re.search(r"\((\d{4})\)", title)
        year  = int(yr.group(1)) if yr else None
        from ml.features import get_genre_chips
        lrow    = links_df[links_df.movieId == row["movieId"]]
        tmdb_id = lrow.iloc[0].get("tmdbId") if not lrow.empty else None
        poster  = fetch_poster(tmdb_id) if tmdb_id else None
        results.append({
            "movie_id":     int(row["movieId"]),
            "title":        clean_title(title),
            "full_title":   title,
            "release_year": year,
            "genres":       row.get("genres", ""),
            "genre_chips":  get_genre_chips(row.get("genres", "")),
            "poster":       poster,
            "source":       "movielens",
        })

    if token:
        try:
            resp = httpx.get(
                f"{TMDB_BASE}/search/movie",
                headers={"Authorization": f"Bearer {token}"},
                params={"query": q, "include_adult": "false", "page": 1},
                timeout=5,
            )
            if resp.status_code == 200:
                ml_titles = {r["title"].lower() for r in results}
                for m in resp.json().get("results", []):
                    title = m.get("title", "")
                    if title.lower() in ml_titles: continue
                    rd    = m.get("release_date", "")
                    year  = int(rd[:4]) if rd else None
                    poster = (f"https://image.tmdb.org/t/p/w200{m['poster_path']}"
                              if m.get("poster_path") else None)
                    results.append({
                        "movie_id":     f"tmdb_{m['id']}",
                        "title":        title,
                        "full_title":   f"{title} ({year})" if year else title,
                        "release_year": year,
                        "genres":       "",
                        "genre_chips":  [],
                        "poster":       poster,
                        "overview":     m.get("overview", ""),
                        "source":       "tmdb",
                        "tmdb_id":      m["id"],
                    })
                    if len(results) >= limit: break
        except Exception as e:
            print(f"TMDB search error: {e}")

    return {"results": results[:limit], "count": len(results[:limit])}

# ── Movies ────────────────────────────────────────────────────

@app.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    movies = state["movies"]
    row    = movies[movies.movieId == movie_id]
    if row.empty: raise HTTPException(404, "Movie not found")
    return row.iloc[0].to_dict()