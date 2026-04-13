# Changelog

## Phase 1 — ML Core + Portfolio Demo
**Completed:** April 2026

### ML Pipeline
- `ml/features.py` — full feature engineering module: user stats, movie stats, genre flags, tier mapping, genre chip helpers
- `ml/train.py` — trains Logistic Regression (45.9%), Random Forest (49.9%), SVD Matrix Factorization (RMSE 0.90)
- `ml/predict.py` — hybrid SVD+RF recommendation engine with cold-start fallback, returns structured card payloads
- `ml/evaluate.py` — SHAP explainability per prediction, global feature importance, human-readable match reasons
- `ml/llm.py` — Claude API integration: recommendation explanations + natural language intent parsing

### API
- `api/main.py` — FastAPI backend with CORS, lifespan model loading, endpoints: `/recommendations`, `/recommendations/user/{id}`, `/recommendations/genres`, `/movies/search`, `/movies/{id}`, `/ratings`

### Frontend
- Vite + React app with Dune design system (`dune.css`)
- `TierBadge.jsx` — Peak Cinema · Masterpiece · Great Watch · Mid · Skip with icons and colours
- `GenreChip.jsx` + `GenreChipList` — icon + colour genre tags
- `RecommendationCard.jsx` — cinematic top-3 cards with confidence arc, SHAP bars, LLM explanation, tier badge, genre chips, Rate It + Watchlist actions
- `App.jsx` — full UI with By User ID / By Genre / Ask Claude tabs, skeleton loading, empty state, error handling

### Branding
- Product named **Lumière** — French for light, cinematic reference to the Lumière brothers
- Logo: film reel mark with projector light beams
- Tagline: "Find peak cinema"
- Dune palette: warm parchment, spice gold, Fremen blue

### Dataset
- MovieLens ml-latest-small: 100,836 ratings · 9,742 movies · 610 users

---

## Phase 2 — Full Web App *(planned)*
- FastAPI `/ratings` endpoint persisted to SQLite
- User accounts + auth
- Model retraining on new user ratings
- React frontend polish
- Deployment on Render / Railway

## Phase 3 — Real Product *(planned)*
- Sentiment analysis on user reviews
- Dark mode
- Social layer
- PostgreSQL

## Phase 4 — Mobile *(planned)*
- React Native iOS + Android