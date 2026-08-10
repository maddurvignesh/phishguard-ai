"""
database.py — local analysis history stored in SQLite.

We deliberately store ONLY the minimum needed for the dashboard:
time, URL, prediction, risk score, risk level.  No passwords, no personal
information, no cookies — and the URL field is truncated for privacy.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from .config import DB_PATH

_SCHEMA = """
CREATE TABLE IF NOT EXISTS analyses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    url          TEXT NOT NULL,
    prediction   TEXT NOT NULL,
    risk_score   REAL NOT NULL,
    risk_level   TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
"""


@contextmanager
def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.executescript(_SCHEMA)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def record_analysis(url: str, prediction: str, risk_score: float, risk_level: str) -> int:
    """Insert one completed analysis into the history table."""
    row_id = 0
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO analyses (url, prediction, risk_score, risk_level, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (str(url)[:500], prediction, float(risk_score), str(risk_level),
             datetime.now().isoformat(timespec="seconds")),
        )
        row_id = int(cur.lastrowid)
    return row_id


def get_history(limit: int = 20) -> list[dict]:
    """Return the most recent analysis records (newest first)."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT url, prediction, risk_score, risk_level, created_at "
            "FROM analyses ORDER BY id DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
    return [
        {
            "url": r[0],
            "prediction": r[1],
            "risk_score": r[2],
            "risk_level": r[3],
            "created_at": r[4],
        }
        for r in rows
    ]


def get_statistics() -> dict:
    """Aggregated dashboard statistics computed from the real history table."""
    with _conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM analyses").fetchone()[0]
        phish = conn.execute(
            "SELECT COUNT(*) FROM analyses WHERE prediction = ?", ("phishing",)
        ).fetchone()[0]
        legit = conn.execute(
            "SELECT COUNT(*) FROM analyses WHERE prediction = ?", ("legitimate",)
        ).fetchone()[0]
        avg = conn.execute(
            "SELECT AVG(risk_score) FROM analyses"
        ).fetchone()[0]

    avg = round(float(avg), 4) if avg is not None else 0.0
    return {
        "total_analyzed": int(total),
        "phishing_detected": int(phish),
        "legitimate_detected": int(legit),
        "average_risk_score": avg,
        "average_risk_percent": round(avg * 100, 1),
    }


def clear_history() -> int:
    """Empty the analysis table (used by the UI reset button)."""
    with _conn() as conn:
        cur = conn.execute("DELETE FROM analyses")
        return int(cur.rowcount or 0)