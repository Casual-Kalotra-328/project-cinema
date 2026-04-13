# 🎬 Lumière

> Personalised movie recommendations powered by collaborative filtering, content-based ML, and LLM explanations — built on MovieLens data with a Dune-inspired design system.

**Built by:** Casual Kalotra · Northeastern University (MS Applied Machine Intelligence)  
**Status:** Phase 1 — ML Core + Portfolio Demo

---

## What It Does

- Recommends movies based on your ratings and preferences
- Uses a hybrid ML pipeline (Random Forest + SVD Matrix Factorization)
- LLM (Claude API) explains *why* each movie was recommended in plain English
- Custom 5-tier rating system: **Peak Cinema · Masterpiece · Great Watch · Mid · Skip**
- Fully explainable via SHAP feature importance
- Dune-inspired warm desert UI — built to grow into a full web product

---

## Project Structure

```
project-cinema/
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
│
├── data/
│   └── ml-latest-small/          # MovieLens dataset (not committed to git)
│       ├── ratings.csv
│       ├── movies.csv
│       ├── tags.csv
│       └── links.csv
│
├── notebooks/
│   └── cinema_recommender.ipynb
│
├── ml/
│   ├── features.py               # Feature engineering
│   ├── train.py                  # Model training pipeline
│   ├── predict.py                # Inference + top-N recommendations
│   ├── evaluate.py               # Metrics + SHAP
│   ├── llm.py                    # Claude API integration
│   └── models/                   # Saved .pkl files (not committed to git)
│
├── api/
│   └── main.py                   # FastAPI app
│
├── frontend/                     # React + Vite app
│   └── src/
│       ├── components/
│       │   ├── TierBadge.jsx
│       │   ├── GenreChip.jsx
│       │   └── RecommendationCard.jsx
│       ├── styles/
│       │   └── dune.css
│       └── App.jsx
│
└── docs/
    ├── PRD.md                    # Full product requirements document
    └── CHANGELOG.md              # What changed and when
```

---

## Quickstart

### 1. Clone the repo
```bash
git clone https://github.com/Casual-Kalotra-328/project-cinema.git
cd project-cinema
```

### 2. Set up environment
```bash
conda create -n cinema python=3.11
conda activate cinema
pip install -r requirements.txt
```

### 3. Add your API key
```bash
cp .env.example .env
# Open .env and add your Anthropic API key
```

### 4. Download the dataset
Place MovieLens ml-latest-small files in `data/ml-latest-small/`

Download from: [grouplens.org/datasets/movielens/latest](https://grouplens.org/datasets/movielens/latest/)

### 5. Train the models
```bash
python -m ml.train
```

### 6. Start the API
```bash
uvicorn api.main:app --reload
```

### 7. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## ML Pipeline

| Model | Purpose | Result |
|---|---|---|
| Logistic Regression | Interpretable baseline | 45.9% accuracy |
| Random Forest | Content-based, cold-start | 49.9% accuracy |
| SVD (Matrix Factorization) | Collaborative filtering | RMSE 0.90 |

> 5-class classification — random baseline is 20%.

### Features Used
- **User:** avg rating, rating count, rating std
- **Movie:** avg rating, rating count, rating std, release year, genre flags
- **Tags:** aggregated per movie
- **Explainability:** SHAP TreeExplainer per prediction

---

## Rating System

| Tier | Icon | Meaning |
|---|---|---|
| Peak Cinema | 🔥 | Life-changing |
| Masterpiece | ✦ | Exceptional craft |
| Great Watch | ◎ | Solid and enjoyable |
| Mid | — | Forgettable |
| Skip | ✕ | Not worth your time |

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML | scikit-learn, scipy, numpy, pandas |
| Explainability | SHAP |
| LLM | Anthropic Claude API |
| Backend | FastAPI + uvicorn |
| Frontend | React + Vite + Tailwind |

---

## Roadmap

- [x] PRD defined
- [x] ML pipeline — features, training, inference, SHAP
- [x] Claude API — recommendation explanations + intent parsing
- [x] FastAPI backend — 6 endpoints
- [x] React frontend — Lumière design system
- [ ] **Phase 2:** User auth + SQLite persistence + model retraining
- [ ] **Phase 3:** Sentiment analysis + dark mode + deployment
- [ ] **Phase 4:** Mobile app

---

## Dataset

[MovieLens ml-latest-small](https://grouplens.org/datasets/movielens/latest/) — 100,836 ratings · 9,742 movies · 610 users

> F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets. ACM TiiS 5, 4: 19:1–19:19.

---

## Author

**Casual Kalotra**  
MS Applied Machine Intelligence · Northeastern University  
[LinkedIn](https://www.linkedin.com/in/casualkalotra) · [GitHub](https://github.com/Casual-Kalotra-328) · kalotracasual@gmail.com