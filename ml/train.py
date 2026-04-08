# ============================================================
#  ml/train.py
#  Project Cinema — Model Training Pipeline
#  Trains LR, RF, and SVD. Saves models to ml/models/
#  Run: python ml/train.py
# ============================================================

import os
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection  import train_test_split
from sklearn.linear_model     import LogisticRegression
from sklearn.ensemble         import RandomForestClassifier
from sklearn.preprocessing    import StandardScaler
from sklearn.metrics          import accuracy_score, classification_report
from scipy.sparse.linalg      import svds
from scipy.sparse             import csr_matrix

from ml.features import (
    load_raw, build_master, get_X_y,
    rating_to_tier, TIER_ORDER, DATA_DIR
)

MODELS_DIR = "ml/models"


# ── Helpers ───────────────────────────────────────────────────

def ensure_models_dir():
    os.makedirs(MODELS_DIR, exist_ok=True)


def print_section(title):
    print(f"\n{'=' * 50}")
    print(f"  {title}")
    print(f"{'=' * 50}")


# ── Model A — Logistic Regression ────────────────────────────

def train_lr(X_train, y_train, Xs_train):
    print_section("Training Logistic Regression")
    lr = LogisticRegression(
        max_iter=500,
        C=1.0,
        class_weight="balanced",
        random_state=42
    )
    lr.fit(Xs_train, y_train)
    print("  ✓ done")
    return lr


# ── Model B — Random Forest ───────────────────────────────────

def train_rf(X_train, y_train):
    print_section("Training Random Forest (~30s)")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    print("  ✓ done")
    return rf


# ── Model C — SVD Matrix Factorization ───────────────────────

def train_svd(ratings: pd.DataFrame, k: int = 50):
    print_section("Training SVD Matrix Factorization")

    # Build user-item matrix
    user_item = ratings.pivot(
        index="userId",
        columns="movieId",
        values="rating"
    ).fillna(0)

    # Mean-center per user to remove rating bias
    user_mean  = user_item.mean(axis=1)
    R_centered = user_item.sub(user_mean, axis=0)

    # Truncated SVD
    U, sigma, Vt = svds(csr_matrix(R_centered), k=k)

    # Reconstruct predicted ratings
    R_pred = (
        np.dot(np.dot(U, np.diag(sigma)), Vt)
        + user_mean.values[:, np.newaxis]
    )
    R_pred_df = pd.DataFrame(
        R_pred.clip(0.5, 5.0),
        index=user_item.index,
        columns=user_item.columns
    )

    print(f"  U shape  : {U.shape}")
    print(f"  Vt shape : {Vt.shape}")
    print("  ✓ done")

    return {
        "R_pred_df": R_pred_df,
        "user_mean": user_mean,
        "user_item": user_item,
        "U": U,
        "sigma": sigma,
        "Vt": Vt,
    }


# ── Evaluation ────────────────────────────────────────────────

def evaluate_classifiers(lr, rf, Xs_test, X_test, y_test):
    print_section("Evaluation — LR & RF")

    lr_preds = lr.predict(Xs_test)
    rf_preds = rf.predict(X_test)

    lr_acc = accuracy_score(y_test, lr_preds)
    rf_acc = accuracy_score(y_test, rf_preds)

    print(f"\n  LR  accuracy : {lr_acc:.4f}")
    print(f"  RF  accuracy : {rf_acc:.4f}")

    print(f"\n  RF Classification Report:")
    print(classification_report(
        y_test, rf_preds,
        labels=TIER_ORDER,
        zero_division=0
    ))

    return lr_acc, rf_acc


def evaluate_svd(svd_artifacts, ratings, n_sample=2000):
    print_section("Evaluation — SVD RMSE")

    R_pred_df = svd_artifacts["R_pred_df"]
    sample    = ratings.sample(n_sample, random_state=42)

    preds = [
        R_pred_df.loc[u, m]
        for u, m in zip(sample.userId, sample.movieId)
    ]
    rmse = np.sqrt(((sample.rating.values - preds) ** 2).mean())
    print(f"  SVD RMSE ({n_sample:,} sample) : {rmse:.4f}")
    return rmse


# ── Save ──────────────────────────────────────────────────────

def save_models(lr, rf, scaler, svd_artifacts):
    print_section("Saving models to ml/models/")
    ensure_models_dir()

    joblib.dump(lr,      f"{MODELS_DIR}/lr_model.pkl")
    joblib.dump(rf,      f"{MODELS_DIR}/rf_model.pkl")
    joblib.dump(scaler,  f"{MODELS_DIR}/scaler.pkl")
    joblib.dump(svd_artifacts["R_pred_df"],
                         f"{MODELS_DIR}/svd_matrix.pkl")
    joblib.dump(svd_artifacts["user_mean"],
                         f"{MODELS_DIR}/svd_user_mean.pkl")

    print("  ✓ lr_model.pkl")
    print("  ✓ rf_model.pkl")
    print("  ✓ scaler.pkl")
    print("  ✓ svd_matrix.pkl")
    print("  ✓ svd_user_mean.pkl")


# ── Main ──────────────────────────────────────────────────────

def main():
    print_section("Project Cinema — Training Pipeline")

    # 1. Load + build features
    print("\nLoading data...")
    data = load_raw(DATA_DIR)
    df   = build_master(data)
    X, y = get_X_y(df)

    # 2. Train / test split — 80/20 stratified
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )
    print(f"\n  Train : {X_train.shape}")
    print(f"  Test  : {X_test.shape}")

    # 3. Scale for LR
    scaler   = StandardScaler()
    Xs_train = scaler.fit_transform(X_train)
    Xs_test  = scaler.transform(X_test)

    # 4. Train all models
    lr  = train_lr(X_train, y_train, Xs_train)
    rf  = train_rf(X_train, y_train)
    svd = train_svd(data["ratings"])

    # 5. Evaluate
    lr_acc, rf_acc = evaluate_classifiers(
        lr, rf, Xs_test, X_test, y_test)
    rmse = evaluate_svd(svd, data["ratings"])

    # 6. Save
    save_models(lr, rf, scaler, svd)

    # 7. Summary
    print_section("Final Results")
    print(f"  Dataset  : ml-latest-small")
    print(f"  Ratings  : {len(data['ratings']):,}")
    print(f"  Users    : {data['ratings'].userId.nunique():,}")
    print(f"  Movies   : {data['ratings'].movieId.nunique():,}")
    print(f"  LR  acc  : {lr_acc:.4f}")
    print(f"  RF  acc  : {rf_acc:.4f}")
    print(f"  SVD RMSE : {rmse:.4f}")
    print(f"\n  Models saved to ml/models/")
    print(f"  ✓ Training complete")


if __name__ == "__main__":
    main()