# ============================================================
#  ml/predict.py
#  Project Cinema — Inference & Recommendations
#  Memory-optimized: SVD matrix stored as float32, top-N only
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
    svd_matrix = joblib.load(f"{MODELS_DIR}/svd_matrix.pkl")

    # ── Memory optimisation: cast SVD matrix to float32 ──────
    # float64 → float32 cuts SVD RAM usage by 50%
    if hasattr(svd_matrix, 'values'):
        svd_matrix = pd.DataFrame(
            svd_matrix.values.astype(np.float32),
            index=svd_matrix.index,
            columns=svd_matrix.columns,
        )

    models = {
        "lr":            joblib.load(f"{MODELS_DIR}/lr_model.pkl"),
        "rf":            joblib.load(f"{MODELS_DIR}/rf_model.pkl"),
        "scaler":        joblib.load(f"{MODELS_DIR}/scaler.pkl"),
        "svd_matrix":    svd_matrix,
        "svd_user_mean": joblib.load(f"{MODELS_DIR}/svd_user_mean.pkl"),
    }
    print("  ✓ all models loaded")
    return models


# ── SVD Recommendations ───────────────────────────────────────

def get_svd_scores(user_id: int, models: dict,
                   ratings: pd.DataFrame) -> pd.Series:
    R_pred_df = models["svd_matrix"]

    if user_id not in R_pred_df.index:
        return pd.Series(dtype=float)

    seen   = set(ratings[ratings.userId == user_id].movieId)
    scores = R_pred_df.loc[user_id].drop(
        index=list(seen), errors="ignore")

    return scores


def get_rf_scores(movie_ids: list, user_id: int,
                  models: dict, df: pd.DataFrame) -> pd.Series:
    rf     = models["rf"]
    scaler = models["scaler"]

    user_row = df[df.userId == user_id][FEATURES].iloc[0] \
        if user_id in df.userId.values \
        else pd.Series(0, index=FEATURES)

    rows = []
    for mid in movie_ids:
        movie_row = df[df.movieId == mid][FEATURES].head(1)
        if movie_row.empty:
            rows.append(pd.Series(0, index=FEATURES))
            continue
        row = movie_row.iloc[0].copy()
        for col in ["user_avg_rating", "user_rating_count",
                    "user_rating_std"]:
            row[col] = user_row.get(col, 0)
        rows.append(row)

    X = pd.DataFrame(rows, index=movie_ids)[FEATURES].fillna(0)

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
                  n_candidates: int = 30) -> pd.Series:
    """
    Blend SVD + RF. n_candidates reduced to 30 to save RAM.
    """
    user_rating_count = len(ratings[ratings.userId == user_id])
    svd_weight = min(0.9, 0.3 + (user_rating_count / 50) * 0.6)
    rf_weight  = 1 - svd_weight

    svd_sc = get_svd_scores(user_id, models, ratings)

    if svd_sc.empty:
        popular = (movies.sort_values("movieId")
                   .head(n_candidates).movieId.tolist())
        return get_rf_scores(popular, user_id, models, df)

    candidates = svd_sc.nlargest(n_candidates).index.tolist()

    top_svd   = svd_sc[candidates]
    svd_min   = top_svd.min()
    svd_range = top_svd.max() - svd_min
    svd_norm  = (top_svd - svd_min) / svd_range \
        if svd_range > 0 else top_svd
    svd_norm  = svd_norm ** 0.5

    rf_sc    = get_rf_scores(candidates, user_id, models, df)
    rf_max   = rf_sc.max()
    rf_norm  = (rf_sc / rf_max) ** 0.5 if rf_max > 0 else rf_sc

    combined = (svd_weight * svd_norm) + (rf_weight * rf_norm)
    return combined.sort_values(ascending=False)


# ── Top-N Recommendations ─────────────────────────────────────

def get_top_n(user_id: int, models: dict,
              ratings: pd.DataFrame,
              df: pd.DataFrame,
              movies: pd.DataFrame,
              n: int = 3) -> list[dict]:
    import re
    scores     = hybrid_scores(user_id, models, ratings,
                                df, movies, n_candidates=30)
    top_ids    = scores.head(n).index.tolist()
    top_scores = scores.head(n)

    results = []
    for mid in top_ids:
        movie_row = movies[movies.movieId == mid]
        if movie_row.empty:
            continue

        row    = movie_row.iloc[0]
        title  = row["title"]
        genres = row.get("genres", "")

        svd_matrix = models["svd_matrix"]
        if (user_id in svd_matrix.index and
                mid in svd_matrix.columns):
            pred_rating = float(svd_matrix.loc[user_id, mid])
        else:
            pred_rating = 3.0

        pred_tier = rating_to_tier(pred_rating)
        tier_meta = get_tier_meta(pred_tier)
        chips     = get_genre_chips(genres)

        yr_match = re.search(r"\((\d{4})\)$", title)
        year = int(yr_match.group(1)) if yr_match else None

        results.append({
            "movie_id":         int(mid),
            "title":            title,
            "genres":           genres,
            "release_year":     year,
            "genre_chips":      chips,
            "predicted_rating": round(pred_rating, 2),
            "predicted_tier":   pred_tier,
            "tier_icon":        tier_meta["icon"],
            "tier_color":       tier_meta["color"],
            "hybrid_score":     round(float(top_scores[mid]), 4),
        })

    return results


# ── Content-Based (cold start) ────────────────────────────────

def get_recs_by_genres(genre_list: list[str],
                       models: dict,
                       df: pd.DataFrame,
                       movies: pd.DataFrame,
                       n: int = 3) -> list[dict]:
    import re
    mask = movies["genres"].apply(
        lambda g: any(genre in g for genre in genre_list)
        if isinstance(g, str) else False)
    candidates = movies[mask]["movieId"].tolist()[:30]

    if not candidates:
        candidates = movies.head(30)["movieId"].tolist()

    rf_sc   = get_rf_scores(candidates, -1, models, df)
    top_ids = rf_sc.nlargest(n).index.tolist()

    results = []
    for mid in top_ids:
        row = movies[movies.movieId == mid].iloc[0]
        avg = df[df.movieId == mid]["avg_rating"].mean()
        avg = avg if not np.isnan(avg) else 3.0

        pred_tier = rating_to_tier(avg)
        tier_meta = get_tier_meta(pred_tier)
        chips     = get_genre_chips(row.get("genres", ""))

        yr_match = re.search(r"\((\d{4})\)$", row["title"])
        year = int(yr_match.group(1)) if yr_match else None

        results.append({
            "movie_id":         int(mid),
            "title":            row["title"],
            "genres":           row.get("genres", ""),
            "release_year":     year,
            "genre_chips":      chips,
            "predicted_rating": round(float(avg), 2),
            "predicted_tier":   pred_tier,
            "tier_icon":        tier_meta["icon"],
            "tier_color":       tier_meta["color"],
            "hybrid_score":     round(float(rf_sc.get(mid, 0)), 4),
        })

    return results


# ── Quick test ────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("=" * 50)
    print("  predict.py — smoke test")
    print("=" * 50)

    data   = load_raw(DATA_DIR)
    movies = build_movie_meta(data["movies"])
    df     = build_master(data)
    models = load_models()

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