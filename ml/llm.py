# ============================================================
#  ml/llm.py
#  Project Cinema — LLM Layer (Claude API)
#  Two roles:
#    1. explain_recommendation() — generates card explanation
#    2. parse_user_intent()      — converts natural language
#                                  input into structured query
#  Run: python -m ml.llm
# ============================================================

import os
import json
import anthropic
from dotenv import load_dotenv

load_dotenv()

CLIENT = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL  = "claude-sonnet-4-20250514"


# ── 1. Recommendation Explanation ────────────────────────────

def explain_recommendation(
    movie_title:     str,
    predicted_tier:  str,
    tier_icon:       str,
    genre_chips:     list[dict],
    match_reason:    str,
    shap_factors:    list[dict],
    user_top_genres: list[str] | None = None,
    similar_movies:  list[str] | None = None,
) -> str:
    """
    Generate a 2-3 sentence explanation for a recommendation card.
    Called once per recommended movie.

    Returns plain text — no markdown, no bullet points.
    Warm, direct, like a knowledgeable film-loving friend.
    """
    genres     = ", ".join(c["name"] for c in genre_chips[:3])
    top_genres = ", ".join(user_top_genres) \
        if user_top_genres else "Drama, Thriller"
    similar    = ", ".join(similar_movies) \
        if similar_movies else "films you've loved"

    top_factors = [f["label"] for f in shap_factors
                   if f["direction"] == "up"][:2]
    factors_str = " and ".join(top_factors) \
        if top_factors else "your taste profile"

    prompt = f"""You are a knowledgeable, warm film recommendation assistant for Project Cinema.

Write a 2-3 sentence explanation for why we're recommending this movie to this user.
Be direct, specific, and enthusiastic — like a film-loving friend, not a robot.
No bullet points. No markdown. No em-dashes. Plain conversational sentences only.

Movie: {movie_title}
Predicted tier: {tier_icon} {predicted_tier}
Genres: {genres}
Key match reasons (from ML model): {factors_str}
User's top genres: {top_genres}
Similar movies they've enjoyed: {similar}
Primary match signal: {match_reason}

Write the explanation now. 2-3 sentences maximum."""

    for attempt in range(3):
        try:
            response = CLIENT.messages.create(
                model=MODEL,
                max_tokens=150,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()
        except anthropic.APIStatusError as e:
            if e.status_code == 529 and attempt < 2:
                import time
                time.sleep(2 ** attempt)
                continue
            # Fallback explanation if all retries fail
            genres = ", ".join(c["name"] for c in genre_chips[:2])
            return (f"{movie_title} is a strong match based on your "
                    f"{genres} preferences and viewing history.")


# ── 2. Natural Language Intent Parser ────────────────────────

def parse_user_intent(user_input: str) -> dict:
    """
    Convert a natural language query into a structured
    intent dict that the recommendation engine can use.

    Input example:
      "I want something dark and psychological, not too long"

    Output example:
      {
        "genres":   ["Thriller", "Drama"],
        "mood":     "dark and psychological",
        "runtime":  "short",
        "tone":     "serious",
        "era":      None,
        "raw":      "I want something dark and psychological..."
      }
    """
    prompt = f"""You are a movie preference parser for Project Cinema.

Extract structured intent from this user query.
Return ONLY a valid JSON object — no explanation, no markdown, no backticks.

Available genres: Action, Comedy, Drama, Romance, Thriller,
Sci-Fi, Horror, Animation, Documentary, Crime, War, Musical,
Adventure, Fantasy, Mystery, Children

Query: "{user_input}"

Return this exact JSON structure:
{{
  "genres":  ["list of matching genres from the available list"],
  "mood":    "1-3 word mood description or null",
  "runtime": "short|medium|long|any",
  "tone":    "light|serious|mixed|any",
  "era":     "classic|modern|recent|any",
  "raw":     "{user_input}"
}}"""

    text = None
    for attempt in range(3):
        try:
            response = CLIENT.messages.create(
                model=MODEL,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.content[0].text.strip()
            break
        except anthropic.APIStatusError as e:
            if e.status_code == 529 and attempt < 2:
                import time
                time.sleep(2 ** attempt)
                continue
            # Fallback — extract basic genre from raw input
            return {
                "genres":  ["Drama"],
                "mood":    None,
                "runtime": "any",
                "tone":    "any",
                "era":     "any",
                "raw":     user_input
            }
    if text is None:
        return {
            "genres":  ["Drama"],
            "mood":    None,
            "runtime": "any",
            "tone":    "any",
            "era":     "any",
            "raw":     user_input
        }

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        # Fallback if parsing fails
        return {
            "genres":  ["Drama"],
            "mood":    None,
            "runtime": "any",
            "tone":    "any",
            "era":     "any",
            "raw":     user_input
        }


# ── 3. Full Card Package ──────────────────────────────────────

def build_card_explanation(
    rec:             dict,
    shap_factors:    list[dict],
    match_reason:    str,
    user_top_genres: list[str] | None = None,
    similar_movies:  list[str] | None = None,
) -> dict:
    """
    Takes a recommendation dict from predict.get_top_n()
    and returns the full card payload including LLM explanation.

    Returns the rec dict enriched with:
      - llm_explanation  : 2-3 sentence explanation string
      - match_reason     : bold headline from evaluate.py
      - shap_factors     : top 4 SHAP factors for the card
    """
    explanation = explain_recommendation(
        movie_title    = rec["title"],
        predicted_tier = rec["predicted_tier"],
        tier_icon      = rec["tier_icon"],
        genre_chips    = rec["genre_chips"],
        match_reason   = match_reason,
        shap_factors   = shap_factors,
        user_top_genres= user_top_genres,
        similar_movies = similar_movies,
    )

    return {
        **rec,
        "llm_explanation": explanation,
        "match_reason":    match_reason,
        "shap_factors":    shap_factors,
    }


# ── Quick test ────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  llm.py — smoke test")
    print("=" * 50)

    # Test 1: recommendation explanation
    print("\n--- Test 1: Recommendation Explanation ---")
    explanation = explain_recommendation(
        movie_title    = "The Dark Knight (2008)",
        predicted_tier = "Peak Cinema",
        tier_icon      = "🔥",
        genre_chips    = [
            {"name": "Action",  "icon": "⚡", "color": "#E8712A"},
            {"name": "Thriller","icon": "👁",  "color": "#8B0000"},
            {"name": "Crime",   "icon": "⦿",  "color": "#2C2C2C"},
        ],
        match_reason   = "Critics rate it highly · high-tension narrative",
        shap_factors   = [
            {"label": "Critics avg",    "direction": "up",   "pct": 34},
            {"label": "Your avg rating","direction": "up",   "pct": 28},
            {"label": "Popularity",     "direction": "up",   "pct": 18},
            {"label": "Release year",   "direction": "down", "pct": 8},
        ],
        user_top_genres = ["Thriller", "Crime", "Drama"],
        similar_movies  = ["Parasite", "Inception", "Se7en"],
    )
    print(f"\n  {explanation}")

    # Test 2: intent parsing
    print("\n--- Test 2: Intent Parser ---")
    queries = [
        "I want something dark and psychological, not too long",
        "Give me a fun comedy for a Friday night",
        "Something like Interstellar but more emotional",
    ]
    for q in queries:
        print(f"\n  Input : \"{q}\"")
        intent = parse_user_intent(q)
        print(f"  Output: {json.dumps(intent, indent=4)}")

    print("\n✓ llm.py OK")