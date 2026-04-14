# ============================================================
#  api/db/database.py
#  Project Cinema — SQLite Database Layer
# ============================================================

import sqlite3
import os

DB_PATH = "api/db/lumiere.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            email      TEXT    UNIQUE,
            avatar     TEXT,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # Add avatar column if it doesn't exist (migration)
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
    except Exception:
        pass

    c.execute("""
        CREATE TABLE IF NOT EXISTS ratings (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            movie_id   INTEGER NOT NULL,
            rating     REAL    NOT NULL,
            tier       TEXT    NOT NULL,
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, movie_id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            movie_id   INTEGER NOT NULL,
            rating_id  INTEGER NOT NULL,
            review     TEXT    NOT NULL,
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id)   REFERENCES users(id),
            FOREIGN KEY (rating_id) REFERENCES ratings(id),
            UNIQUE(user_id, movie_id)
        )
    """)

    conn.commit()
    conn.close()
    print("✓ Database initialised")


# ── Users ─────────────────────────────────────────────────────

def create_user(name: str, email: str | None = None) -> dict:
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("INSERT INTO users (name, email) VALUES (?, ?)", (name.strip(), email))
        conn.commit()
        return get_user(c.lastrowid)
    finally:
        conn.close()


def get_user(user_id: int) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_avatar(user_id: int, avatar_b64: str) -> dict | None:
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET avatar=? WHERE id=?", (avatar_b64, user_id))
        conn.commit()
        return get_user(user_id)
    finally:
        conn.close()


# ── Ratings ───────────────────────────────────────────────────

def _to_tier(r: float) -> str:
    if r >= 4.5: return "Peak Cinema"
    if r >= 3.5: return "Masterpiece"
    if r >= 2.5: return "Great Watch"
    if r >= 1.5: return "Mid"
    return "Skip"


def save_rating(user_id: int, movie_id: int, rating: float) -> dict:
    tier = _to_tier(rating)
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO ratings (user_id, movie_id, rating, tier)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, movie_id)
            DO UPDATE SET rating=excluded.rating, tier=excluded.tier,
                          created_at=datetime('now')
        """, (user_id, movie_id, rating, tier))
        conn.commit()
        row = conn.execute(
            "SELECT * FROM ratings WHERE user_id=? AND movie_id=?",
            (user_id, movie_id)
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


def save_review(user_id: int, movie_id: int, rating_id: int, review: str) -> dict:
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO reviews (user_id, movie_id, rating_id, review)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, movie_id)
            DO UPDATE SET review=excluded.review, created_at=datetime('now')
        """, (user_id, movie_id, rating_id, review))
        conn.commit()
        row = conn.execute(
            "SELECT * FROM reviews WHERE user_id=? AND movie_id=?",
            (user_id, movie_id)
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


# ── History ───────────────────────────────────────────────────

def get_user_history(user_id: int) -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT
                r.id         AS rating_id,
                r.movie_id,
                r.rating,
                r.tier,
                r.created_at AS rated_at,
                rv.review,
                rv.created_at AS reviewed_at
            FROM ratings r
            LEFT JOIN reviews rv
                ON rv.user_id  = r.user_id
                AND rv.movie_id = r.movie_id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        """, (user_id,)).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_rating_count() -> int:
    conn = get_conn()
    try:
        return conn.execute("SELECT COUNT(*) FROM ratings").fetchone()[0]
    finally:
        conn.close()