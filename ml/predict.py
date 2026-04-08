# ============================================================
#  ml/predict.py
#  Project Cinema — Inference & Recommendations
#  Loads saved models and returns top-N recommendations.
#  Called by the API and the portfolio demo.
#  Run: python -m ml.predict
# ============================================================

import joblib
import numpy as np
import pandas as pd

from ml.features import (
    load_raw, build_master, build_movie_meta,
    build_movie_tags, build_user_stats, build_movie_stats,
    rating_to_tier, get_genre_chips, get_tier_meta,
    DATA_DIR, FEATURES, TIER_ORDER
)

MODELS_DIR = "ml/models"


# ── Load Models ───────────────────────────────────────────────

def load_models():
    """Load all saved models from ml/models/."""
    print("Loading models...")
    models = {
        "lr":            joblib.load(f"{MODELS_DIR}/lr_model.pkl"),
        "rf":            joblib.load(f"{MODELS_DIR}/rf_model.pkl"),
        "scaler":        joblib.load(f"{MODELS_DIR}/scaler.pkl"),
        "svd_matrix":   joblib.load(f"{MODELS_DIR}/svd_matrix.pkl"),
        "svd_user_mean": joblib.load(f"{MODELS_DIR}/svd_user_mean.pkl"),
    }
    print("  ✓ all models loaded")
    return models


# ── SVD Recommendations ───────────────────────────────────────

def get_svd_scores(user_id: int, models: dict,
                   ratings: pd.DataFrame) -> pd.Series:
    """
    Return predicted rating scores for all unseen movies
    for a given user, using the SVD matrix.
    """
    R_pred_df = models["svd_matrix"]

    if user_id not in R_pred_df.index:
        return pd.Series(dtype=float)

    # Movies the user has already rated
    seen = set(ratings[ratings.userId == user_id].movieId)

    # Drop seen movies from predictions
    scores = R_pred_df.loc[user_id].drop(
        index=list(seen), errors="ignore")

    return scores


def get_rf_scores(movie_ids: list, user_id: int,
                  models: dict, df: pd.DataFrame) -> pd.Series:
    """
    Return RF predicted tier probabilities for a list of movies
    for a given user. Returns probability of top 2 tiers combined
    as a single score per movie.
    """
    rf     = models["rf"]
    scaler = models["scaler"]

    # Get user stats row
    user_row = df[df.userId == user_id][FEATURES].iloc[0] \
        if user_id in df.userId.values \
        else pd.Series(0, index=FEATURES)

    # Build feature rows — one per movie
    rows = []
    for mid in movie_ids:
        movie_row = df[df.movieId == mid][FEATURES].head(1)
        if movie_row.empty:
            rows.append(pd.Series(0, index=FEATURES))
            continue
        row = movie_row.iloc[0].copy()
        # Override user-side features with this user's stats
        for col in ["user_avg_rating", "user_rating_count",
                    "user_rating_std"]:
            row[col] = user_row.get(col, 0)
        rows.append(row)

    X = pd.DataFrame(rows, index=movie_ids)[FEATURES].fillna(0)

    # Probability of "Peak Cinema" + "Masterpiece"
    proba   = rf.predict_proba(X)
    classes = list(rf.classes_)
    scores  = {}
    for i, mid in enumerate(movie_ids):
        pc_idx = classes.index("Peak Cinema") \
            if "Peak Cinema" in classes else -1
        mp_idx = classes.index("Masterpiece") \
            if "Masterpiece" in classes else -1
        score  = 0
        if pc_idx >= 0: score += proba[i][pc_idx]
        if mp_idx >= 0: score += proba[i][mp_idx]
        scores[mid] = score

    return pd.Series(scores)


# ── Hybrid Scoring ────────────────────────────────────────────

def hybrid_scores(user_id: int, models: dict,
                  ratings: pd.DataFrame,
                  df: pd.DataFrame,
                  movies: pd.DataFrame,
                  n_candidates: int = 50) -> pd.Series:
    """
    Blend SVD (collaborative) + RF (content) scores.
    SVD weight increases as user rates more movies.
    New users lean on RF; warm users lean on SVD.
    """
    user_rating_count = len(ratings[ratings.userId == user_id])

    # Weight: ramps from 0.2 → 0.8 as user rates more
    svd_weight = min(0.8, 0.2 + (user_rating_count / 100) * 0.6)
    rf_weight  = 1 - svd_weight

    # SVD scores
    svd_sc = get_svd_scores(user_id, models, ratings)

    if svd_sc.empty:
        # Cold start — use RF only on popular movies
        popular = (movies.sort_values("movieId")
                   .head(n_candidates).movieId.tolist())
        return get_rf_scores(popular, user_id, models, df)

    # Take top candidates from SVD
    candidates = svd_sc.nlargest(n_candidates).index.tolist()

    # Normalize SVD scores to [0, 1]
    svd_norm = (svd_sc[candidates] - svd_sc[candidates].min())
    rng      = svd_sc[candidates].max() - svd_sc[candidates].min()
    svd_norm = svd_norm / rng if rng > 0 else svd_norm

    # RF scores for same candidates
    rf_sc   = get_rf_scores(candidates, user_id, models, df)
    rf_norm = rf_sc / rf_sc.max() if rf_sc.max() > 0 else rf_sc

    # Blend
    combined = (svd_weight * svd_norm) + (rf_weight * rf_norm)
    return combined.sort_values(ascending=False)


# ── Top-N Recommendations ─────────────────────────────────────

def get_top_n(user_id: int, models: dict,
              ratings: pd.DataFrame,
              df: pd.DataFrame,
              movies: pd.DataFrame,
              n: int = 3) -> list[dict]:
    """
    Return top-N movie recommendations for a user as a list
    of dicts ready for the frontend / API.

    Each dict contains:
      movie_id, title, genres, release_year,
      genre_chips, predicted_rating, predicted_tier,
      tier_meta, hybrid_score
    """
    scores    = hybrid_scores(user_id, models, ratings,
                               df, movies, n_candidates=50)
    top_ids   = scores.head(n).index.tolist()
    top_scores = scores.head(n)

    results = []
    for mid in top_ids:
        movie_row = movies[movies.movieId == mid]
        if movie_row.empty:
            continue

        row    = movie_row.iloc[0]
        title  = row["title"]
        genres = row.get("genres", "")

        # Predicted rating from SVD (if available)
        svd_matrix = models["svd_matrix"]
        if (user_id in svd_matrix.index and
                mid in svd_matrix.columns):
            pred_rating = float(svd_matrix.loc[user_id, mid])
        else:
            pred_rating = 3.0

        pred_tier = rating_to_tier(pred_rating)
        tier_meta = get_tier_meta(pred_tier)
        chips     = get_genre_chips(genres)

        # Release year
        import re
        yr_match = re.search(r"\((\d{4})\)$", title)
        year = int(yr_match.group(1)) if yr_match else None

        results.append({
            "movie_id":        int(mid),
            "title":           title,
            "genres":          genres,
            "release_year":    year,
            "genre_chips":     chips,
            "predicted_rating": round(pred_rating, 2),
            "predicted_tier":  pred_tier,
            "tier_icon":       tier_meta["icon"],
            "tier_color":      tier_meta["color"],
            "hybrid_score":    round(float(top_scores[mid]), 4),
        })

    return results


# ── Content-Based (cold start) ────────────────────────────────

def get_recs_by_genres(genre_list: list[str],
                       models: dict,
                       df: pd.DataFrame,
                       movies: pd.DataFrame,
                       n: int = 3) -> list[dict]:
    """
    For new users with no rating history.
    Filter movies by genres, rank by avg_rating + RF score.
    """
    # Filter movies matching any requested genre
    mask = movies["genres"].apply(
        lambda g: any(genre in g for genre in genre_list)
        if isinstance(g, str) else False)
    candidates = movies[mask]["movieId"].tolist()[:50]

    if not candidates:
        candidates = movies.head(50)["movieId"].tolist()

    rf_sc  = get_rf_scores(candidates, -1, models, df)
    top_ids = rf_sc.nlargest(n).index.tolist()

    results = []
    for mid in top_ids:
        row = movies[movies.movieId == mid].iloc[0]
        avg = df[df.movieId == mid]["avg_rating"].mean()
        avg = avg if not np.isnan(avg) else 3.0

        pred_tier = rating_to_tier(avg)
        tier_meta = get_tier_meta(pred_tier)
        chips     = get_genre_chips(row.get("genres", ""))

        import re
        yr_match = re.search(r"\((\d{4})\)$", row["title"])
        year = int(yr_match.group(1)) if yr_match else None

        results.append({
            "movie_id":        int(mid),
            "title":           row["title"],
            "genres":          row.get("genres", ""),
            "release_year":    year,
            "genre_chips":     chips,
            "predicted_rating": round(float(avg), 2),
            "predicted_tier":  pred_tier,
            "tier_icon":       tier_meta["icon"],
            "tier_color":      tier_meta["color"],
            "hybrid_score":    round(float(rf_sc.get(mid, 0)), 4),
        })

    return results


# ── Quick test ────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("=" * 50)
    print("  predict.py — smoke test")
    print("=" * 50)

    # Load data
    data   = load_raw(DATA_DIR)
    movies = build_movie_meta(data["movies"])
    df     = build_master(data)
    models = load_models()

    # Test warm user (has ratings)
    print("\n--- Top 3 for User #1 (warm) ---")
    recs = get_top_n(1, models, data["ratings"], df, movies, n=3)
    for i, r in enumerate(recs, 1):
        chips = " ".join(
            f"{c['icon']}{c['name']}" for c in r["genre_chips"])
        print(f"\n  #{i} {r['title']} ({r['release_year']})")
        print(f"      {r['tier_icon']} {r['predicted_tier']} "
              f"— predicted {r['predicted_rating']}/5")
        print(f"      {chips}")
        print(f"      hybrid score: {r['hybrid_score']}")

    # Test cold start (genre-based)
    print("\n--- Cold start: Drama + Thriller ---")
    cold = get_recs_by_genres(
        ["Drama", "Thriller"], models, df, movies, n=3)
    for i, r in enumerate(cold, 1):
        chips = " ".join(
            f"{c['icon']}{c['name']}" for c in r["genre_chips"])
        print(f"\n  #{i} {r['title']} ({r['release_year']})")
        print(f"      {r['tier_icon']} {r['predicted_tier']} "
              f"— avg {r['predicted_rating']}/5")
        print(f"      {chips}")

    print("\n✓ predict.py OK")