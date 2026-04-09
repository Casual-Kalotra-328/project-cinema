# ============================================================
#  ml/evaluate.py
#  Project Cinema — Explainability & Evaluation
#  Computes SHAP values per prediction and global importance.
#  Powers the "why this movie?" card explanation.
#  Run: python -m ml.evaluate
# ============================================================

import joblib
import numpy as np
import pandas as pd
import shap
import warnings
warnings.filterwarnings("ignore")

from ml.features import (
    load_raw, build_master, get_X_y,
    get_tier_meta, FEATURES, DATA_DIR, TIER_ORDER
)

MODELS_DIR  = "ml/models"
SHAP_LABELS = {
    "user_avg_rating":    "Your avg rating",
    "user_rating_count":  "Your activity",
    "user_rating_std":    "Your rating range",
    "avg_rating":         "Critics avg",
    "rating_count":       "Popularity",
    "rating_std":         "Rating consistency",
    "release_year":       "Release year",
    "genre_count":        "Genre depth",
    "Action":             "Action",
    "Comedy":             "Comedy",
    "Drama":              "Drama",
    "Romance":            "Romance",
    "Thriller":           "Thriller",
    "Sci-Fi":             "Sci-Fi",
    "Horror":             "Horror",
    "Animation":          "Animation",
}


# ── Load ──────────────────────────────────────────────────────

def load_rf():
    return joblib.load(f"{MODELS_DIR}/rf_model.pkl")


# ── Global SHAP ───────────────────────────────────────────────

def global_shap(rf, X_sample: pd.DataFrame) -> pd.Series:
    """
    Compute mean |SHAP| across all tiers for a sample.
    Returns a Series sorted by importance descending.
    """
    print("Computing global SHAP values...")
    explainer = shap.TreeExplainer(rf)
    shap_vals = explainer.shap_values(X_sample)

    # Handle both old (list) and new (3D array) SHAP formats
    if isinstance(shap_vals, list):
        mean_shap = np.mean([np.abs(sv).mean(0)
                             for sv in shap_vals], 0)
    else:
        mean_shap = np.abs(shap_vals).mean(axis=(0, 2)) \
            if shap_vals.ndim == 3 \
            else np.abs(shap_vals).mean(0)

    importance = (pd.Series(mean_shap, index=FEATURES)
                  .rename(index=SHAP_LABELS)
                  .sort_values(ascending=False))
    print("  ✓ done")
    return importance


# ── Per-prediction SHAP ───────────────────────────────────────

def explain_prediction(rf, X_row: pd.DataFrame,
                        predicted_tier: str) -> list[dict]:
    """
    Compute SHAP values for a single prediction row.
    Returns top 4 features as a list of dicts for the UI:
      [{ label, value, direction, pct }, ...]

    direction: "up" = pushed toward predicted tier
               "down" = pulled away from predicted tier
    """
    explainer = shap.TreeExplainer(rf)
    shap_vals = explainer.shap_values(X_row)

    # Get SHAP values for the predicted tier class
    classes = list(rf.classes_)
    if predicted_tier in classes:
        tier_idx = classes.index(predicted_tier)
    else:
        tier_idx = 0

    if isinstance(shap_vals, list):
        sv = shap_vals[tier_idx][0]
    else:
        sv = shap_vals[0, :, tier_idx] \
            if shap_vals.ndim == 3 else shap_vals[0]

    # Build feature importance list
    feature_shap = list(zip(FEATURES, sv))
    feature_shap.sort(key=lambda x: abs(x[1]), reverse=True)

    total = sum(abs(v) for _, v in feature_shap) or 1
    result = []

    for feat, val in feature_shap[:4]:
        label = SHAP_LABELS.get(feat, feat)
        pct   = round(abs(val) / total * 100)
        result.append({
            "feature":   feat,
            "label":     label,
            "value":     round(float(val), 4),
            "direction": "up" if val >= 0 else "down",
            "pct":       pct,
        })

    return result


# ── Human-readable reason ─────────────────────────────────────

def build_match_reason(shap_factors: list[dict],
                       predicted_tier: str,
                       movie_title: str) -> str:
    """
    Convert top SHAP factors into a single bold headline
    shown on the recommendation card.
    e.g. "Because critics love it and matches your taste"
    """
    top = shap_factors[0]["feature"] if shap_factors else ""

    reasons = {
        "avg_rating":        "Critics rate it highly",
        "user_avg_rating":   "Matches your taste profile",
        "rating_count":      "Loved by a large audience",
        "user_rating_count": "Based on your rich history",
        "rating_std":        "Consistent crowd favourite",
        "user_rating_std":   "Fits your rating patterns",
        "release_year":      "From your preferred era",
        "Drama":             "Strong dramatic storytelling",
        "Thriller":          "High-tension narrative",
        "Action":            "High-energy action",
        "Comedy":            "Light and fun",
        "Sci-Fi":            "Fits your Sci-Fi taste",
        "Horror":            "Fits your Horror taste",
        "Romance":           "Romantic storyline match",
        "Animation":         "Animation you'll enjoy",
        "genre_count":       "Rich multi-genre experience",
    }

    second = shap_factors[1]["feature"] \
        if len(shap_factors) > 1 else None
    second_reason = reasons.get(second, "").lower() \
        if second else ""

    primary = reasons.get(top, "Strong overall match")

    if second_reason:
        return f"{primary} · {second_reason}"
    return primary


# ── Full explanation for one movie ────────────────────────────

def explain_movie(rf, movie_id: int, user_id: int,
                  df: pd.DataFrame,
                  predicted_tier: str) -> dict:
    """
    Full explanation package for one recommendation card.
    Returns shap_factors + match_reason + tier_meta.
    """
    # Get the feature row for this user-movie pair
    row = df[(df.movieId == movie_id)][FEATURES].head(1)
    if row.empty:
        return {"shap_factors": [], "match_reason": "Strong match",
                "tier_meta": get_tier_meta(predicted_tier)}

    # Override user features with actual user stats
    user_row = df[df.userId == user_id][FEATURES].head(1)
    if not user_row.empty:
        for col in ["user_avg_rating", "user_rating_count",
                    "user_rating_std"]:
            row[col] = user_row.iloc[0][col]

    shap_factors = explain_prediction(rf, row, predicted_tier)
    match_reason = build_match_reason(
        shap_factors, predicted_tier, "")
    tier_meta    = get_tier_meta(predicted_tier)

    return {
        "shap_factors": shap_factors,
        "match_reason": match_reason,
        "tier_meta":    tier_meta,
    }


# ── Quick test ────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  evaluate.py — smoke test")
    print("=" * 50)

    data = load_raw(DATA_DIR)
    df   = build_master(data)
    X, y = get_X_y(df)
    rf   = load_rf()

    # Global importance
    print("\n--- Global SHAP Importance ---")
    importance = global_shap(rf, X.iloc[:300])
    print(importance.round(4).to_string())

    # Per-prediction explanation for movie 1 / user 1
    print("\n--- Per-prediction explanation ---")
    print("Movie: Toy Story (1995) | User: 1")
    explanation = explain_movie(rf, 1, 1, df, "Masterpiece")

    print(f"\n  Match reason : {explanation['match_reason']}")
    print(f"  Tier         : "
          f"{explanation['tier_meta']['icon']} "
          f"Masterpiece")
    print(f"\n  Top SHAP factors:")
    for f in explanation["shap_factors"]:
        bar = "█" * int(f["pct"] / 5)
        arrow = "↑" if f["direction"] == "up" else "↓"
        print(f"    {arrow} {f['label']:<25} "
              f"{bar:<20} {f['pct']}%")

    print("\n✓ evaluate.py OK")