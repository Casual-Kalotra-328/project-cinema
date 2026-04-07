🎬 Project Cinema

A personalised movie recommender powered by collaborative filtering, content-based ML, and LLM explanations — built on MovieLens data with a Dune-inspired design system.

Built by: Casual Kalotra · Northeastern University (MS Applied Machine Intelligence)
Status: Phase 1 — ML Core + Portfolio Demo

What It Does

Recommends movies based on your ratings and preferences
Uses a hybrid ML pipeline (Random Forest + SVD Matrix Factorization)
LLM (Claude API) explains why each movie was recommended in plain English
Custom 5-tier rating system: Peak Cinema · Masterpiece · Great Watch · Mid · Skip
Fully explainable via SHAP feature importance
Dune-inspired warm desert UI — built to grow into a full web product


Project Structure
project-cinema/
│
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
│
├── data/
│   └── ml-latest-small/        # MovieLens dataset (not committed to git)
│       ├── ratings.csv
│       ├── movies.csv
│       ├── tags.csv
│       └── links.csv
│
├── notebooks/
│   └── cinema_recommender.ipynb
│
├── ml/
│   ├── features.py             # Feature engineering
│   ├── train.py                # Model training pipeline
│   ├── predict.py              # Inference + top-N recommendations
│   ├── evaluate.py             # Metrics + SHAP
│   └── models/                 # Saved .pkl files (not committed to git)
│
├── api/
│   ├── main.py                 # FastAPI app (Phase 2)
│   ├── routes/
│   │   ├── recommendations.py
│   │   ├── ratings.py
│   │   └── llm.py
│   └── db/
│       ├── database.py
│       └── schema.sql
│
├── frontend/                   # React app (Phase 2)
│   └── src/
│       ├── components/
│       ├── pages/
│       └── styles/
│
└── docs/
    ├── PRD.md                  # Full product requirements document
    └── CHANGELOG.md            # What changed and when

Quickstart
1. Clone the repo
bashgit clone https://github.com/Casual-Kalotra-328/project-cinema.git
cd project-cinema
2. Set up environment
bashconda create -n cinema python=3.11
conda activate cinema
pip install -r requirements.txt
3. Add your API key
bashcp .env.example .env
# Open .env and add your Anthropic API key
4. Download the dataset
bash# Place MovieLens ml-latest-small files in:
# data/ml-latest-small/
# Download from: https://grouplens.org/datasets/movielens/latest/
5. Train the models
bashpython ml/train.py
6. Run the notebook
bashjupyter notebook notebooks/cinema_recommender.ipynb

ML Pipeline
ModelPurposeAccuracyLogistic RegressionInterpretable baseline~39%Random ForestContent-based, cold-start~47%SVD (Matrix Factorization)Collaborative filteringRMSE ~0.90

Note: 47% on a 5-class problem is strong — random baseline is 20%.

Features Used

User: avg rating, rating count, rating std
Movie: avg rating, rating count, rating std, release year, genre flags
Tags: aggregated per movie (Phase 2)
Reviews: sentiment score (Phase 3)


Rating System
TierIconMeaningPeak Cinema🔥Life-changingMasterpiece✦Exceptional craftGreat Watch◎Solid and enjoyableMid—ForgettableSkip✕Not worth your time

Tech Stack
LayerTechnologyMLscikit-learn, scipy, numpy, pandasExplainabilitySHAPLLMAnthropic Claude APIBackendFastAPI (Phase 2)FrontendReact + Tailwind (Phase 2)DatabaseSQLite → PostgreSQL (Phase 2+)

Roadmap

 PRD defined
 Dataset loaded + explored
 Phase 1: ML pipeline + SHAP + Top 3 LLM recommendation cards
 Phase 2: FastAPI backend + React frontend + user accounts
 Phase 3: Sentiment analysis + dark mode + social layer
 Phase 4: Mobile app


Dataset
MovieLens ml-latest-small — 100,836 ratings, 9,742 movies, 610 users.

F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets. ACM TiiS 5, 4: 19:1–19:19.


Author
Casual Kalotra
MS Applied Machine Intelligence · Northeastern University
LinkedIn · GitHub · kalotracasual@gmail.com