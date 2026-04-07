# ============================================================
#  ml/features.py
#  Project Cinema — Feature Engineering
#  All feature logic lives here. Imported by train.py,
#  predict.py, and the API. Never duplicate this elsewhere.
# ============================================================

import pandas as pd
import numpy as np

# ── Constants ────────────────────────────────────────────────

DATA_DIR = "data/ml-latest-small"

TOP_GENRES = [
    "Action", "Comedy", "Drama", "Romance",
    "Thriller", "Sci-Fi", "Horror", "Animation"
]

FEATURES = [
    "user_avg_rating",
    "user_rating_count",
    "user_rating_std",
    "avg_rating",
    "rating_count",
    "rating_std",
    "release_year",
    "genre_count",
] + TOP_GENRES

TIER_MAP = {
    5.0: "Peak Cinema",
    4.5: "Peak Cinema",
    4.0: "Masterpiece",
    3.5: "Masterpiece",
    3.0: "Great Watch",
    2.5: "Great Watch",
    2.0: "Mid",
    1.5: "Mid",
    1.0: "Skip",
    0.5: "Skip",
}

TIER_ORDER = ["Peak Cinema", "Masterpiece", "Great Watch", "Mid", "Skip"]

TIER_META = {
    "Peak Cinema":  {"icon": "🔥", "color": "#C8821A"},
    "Masterpiece":  {"icon": "✦",  "color": "#D4A017"},
    "Great Watch":  {"icon": "◎",  "color": "#2D9CDB"},
    "Mid":          {"icon": "—",  "color": "#8A7560"},
    "Skip":         {"icon": "✕",  "color": "#8B4513"},
}

GENRE_META = {
    "Action":       {"icon": "⚡", "color": "#E8712A"},
    "Drama":        {"icon": "🎭", "color": "#1A5A8A"},
    "Thriller":     {"icon": "👁",  "color": "#8B0000"},
    "Comedy":       {"icon": "☀",  "color": "#F5C518"},
    "Sci-Fi":       {"icon": "◈",  "color": "#00B4D8"},
    "Horror":       {"icon": "☽",  "color": "#4A0E8F"},
    "Romance":      {"icon": "♡",  "color": "#E8436A"},
    "Animation":    {"icon": "✦",  "color": "#7CB518"},
    "Documentary":  {"icon": "◉",  "color": "#4A6FA5"},
    "Crime":        {"icon": "⦿",  "color": "#2C2C2C"},
    "War":          {"icon": "✦",  "color": "#4A5240"},
    "Musical":      {"icon": "♪",  "color": "#C7369A"},
    "Adventure":    {"icon": "◎",  "color": "#E8A020"},
    "Fantasy":      {"icon": "◈",  "color": "#7B2FBE"},
    "Mystery":      {"icon": "◉",  "color": "#2C5F6E"},
    "Children":     {"icon": "☀",  "color": "#F5A623"},
}


# ── Data Loading ─────────────────────────────────────────────

def load_raw(data_dir: str = DATA_DIR) -> dict:
    """
    Load all 4 MovieLens CSV files from data_dir.
    Returns a dict with keys: ratings, movies, tags, links.
    """
    ratings = pd.read_csv(f"{data_dir}/ratings.csv")
    movies  = pd.read_csv(f"{data_dir}/movies.csv")
    tags    = pd.read_csv(f"{data_dir}/tags.csv")
    links   = pd.read_csv(f"{data_dir}/links.csv",
                          dtype={"imdbId": "str", "tmdbId": "str"})

    print(f"  ratings : {len(ratings):>7,} rows")
    print(f"  movies  : {len(movies):>7,} rows")
    print(f"  tags    : {len(tags):>7,} rows")
    print(f"  links   : {len(links):>7,} rows")

    return {"ratings": ratings, "movies": movies,
            "tags": tags, "links": links}


# ── Feature Builders ─────────────────────────────────────────

def build_user_stats(ratings: pd.DataFrame) -> pd.DataFrame:
    """Per-user: avg rating, count, std."""
    stats = (ratings.groupby("userId")["rating"]
             .agg(user_avg_rating="mean",
                  user_rating_count="count",
                  user_rating_std="std")
             .reset_index())
    stats["user_rating_std"] = stats["user_rating_std"].fillna(0)
    return stats


def build_movie_stats(ratings: pd.DataFrame) -> pd.DataFrame:
    """Per-movie: avg rating, count, std."""
    stats = (ratings.groupby("movieId")["rating"]
             .agg(avg_rating="mean",
                  rating_count="count",
                  rating_std="std")
             .reset_index())
    stats["rating_std"] = stats["rating_std"].fillna(0)
    return stats


def build_movie_meta(movies: pd.DataFrame) -> pd.DataFrame:
    """Extract release year, genre count, and genre flags."""
    df = movies.copy()

    # Release year from title e.g. "Toy Story (1995)"
    df["release_year"] = (df["title"]
        .str.extract(r"\((\d{4})\)$")
        .astype("float32"))

    # Number of genres
    df["genre_count"] = df["genres"].apply(
        lambda x: 0 if x == "(no genres listed)"
        else len(x.split("|")))

    # Binary genre flags
    for g in TOP_GENRES:
        df[g] = df["genres"].str.contains(g, na=False).astype("int8")

    return df


def build_movie_tags(tags: pd.DataFrame) -> pd.DataFrame:
    """Aggregate all tags per movie into a single string."""
    movie_tags = (tags.groupby("movieId")["tag"]
        .apply(lambda x: " | ".join(
            x.dropna().astype(str).str.lower().unique()))
        .reset_index()
        .rename(columns={"tag": "all_tags"}))
    return movie_tags


def add_tier(ratings: pd.DataFrame) -> pd.DataFrame:
    """Map numeric ratings → 5-tier label."""
    df = ratings.copy()
    df["tier"] = df["rating"].map(TIER_MAP)
    df["date"] = (pd.to_datetime(df["timestamp"], unit="s")
                  .dt.strftime("%Y-%m-%d"))
    return df


# ── Master Builder ────────────────────────────────────────────

def build_master(data: dict) -> pd.DataFrame:
    """
    Full pipeline: takes raw data dict, returns merged
    master dataframe ready for model training.
    """
    ratings = data["ratings"]
    movies  = data["movies"]
    tags    = data["tags"]
    links   = data["links"]

    print("Building features...")

    user_stats  = build_user_stats(ratings)
    movie_stats = build_movie_stats(ratings)
    movie_meta  = build_movie_meta(movies)
    movie_tags  = build_movie_tags(tags)
    ratings     = add_tier(ratings)

    df = (ratings
        .merge(user_stats,  on="userId",  how="left")
        .merge(movie_stats, on="movieId", how="left")
        .merge(movie_meta,  on="movieId", how="left")
        .merge(links,       on="movieId", how="left")
        .merge(movie_tags,  on="movieId", how="left")
    )

    df["all_tags"] = df["all_tags"].fillna("")

    print(f"  master df : {df.shape}")
    print(f"  tiers     :\n{df['tier'].value_counts().to_string()}")

    return df


def get_X_y(df: pd.DataFrame):
    """
    Extract feature matrix X and label vector y
    from master dataframe. Ready for sklearn.
    """
    X = df[FEATURES].fillna(0)
    y = df["tier"]
    return X, y


# ── Helpers ───────────────────────────────────────────────────

def rating_to_tier(r: float) -> str:
    """Convert a numeric rating to a tier label."""
    if r >= 4.5: return "Peak Cinema"
    if r >= 3.5: return "Masterpiece"
    if r >= 2.5: return "Great Watch"
    if r >= 1.5: return "Mid"
    return "Skip"


def get_genre_chips(genres_str: str) -> list:
    """
    Parse a pipe-separated genres string into a list of
    dicts with name, icon, and color for the UI.
    e.g. "Action|Drama" → [{"name":"Action","icon":"⚡","color":"#E8712A"}, ...]
    """
    if not genres_str or genres_str == "(no genres listed)":
        return []
    genres = genres_str.split("|")
    chips = []
    for g in genres:
        g = g.strip()
        meta = GENRE_META.get(g, {"icon": "◎", "color": "#8A7560"})
        chips.append({"name": g, "icon": meta["icon"], "color": meta["color"]})
    return chips


def get_tier_meta(tier: str) -> dict:
    """Return icon and color for a given tier label."""
    return TIER_META.get(tier, {"icon": "?", "color": "#8A7560"})


# ── Quick test ────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 45)
    print("  features.py — smoke test")
    print("=" * 45)

    data = load_raw()
    df   = build_master(data)
    X, y = get_X_y(df)

    print(f"\nX shape : {X.shape}")
    print(f"y shape : {y.shape}")
    print(f"\nSample row:\n{X.iloc[0]}")
    print(f"\nTier    : {y.iloc[0]}")
    print(f"\nGenre chips for 'Action|Drama|Thriller':")
    print(get_genre_chips("Action|Drama|Thriller"))
    print(f"\nTier meta for 'Peak Cinema':")
    print(get_tier_meta("Peak Cinema"))
    print("\n✓ features.py OK")
