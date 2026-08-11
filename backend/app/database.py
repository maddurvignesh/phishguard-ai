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
    analysis_id  TEXT,
    url          TEXT NOT NULL,
    prediction   TEXT NOT NULL,
    risk_score   REAL NOT NULL,
    risk_level   TEXT NOT NULL,
    model        TEXT,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
"""


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after the first release without dropping data."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(analyses)")}
    if "analysis_id" not in cols:
        conn.execute("ALTER TABLE analyses ADD COLUMN analysis_id TEXT")
    if "model" not in cols:
        conn.execute("ALTER TABLE analyses ADD COLUMN model TEXT")


@contextmanager
def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.executescript(_SCHEMA)
    _migrate(conn)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def record_analysis(
    url: str,
    prediction: str,
    risk_score: float,
    risk_level: str,
    model: str = "",
    analysis_id: str = "",
) -> int:
    """Insert one completed analysis into the history table."""
    row_id = 0
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO analyses (analysis_id, url, prediction, risk_score, "
            "risk_level, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(analysis_id), str(url)[:500], prediction, float(risk_score),
             str(risk_level), str(model),
             datetime.now().isoformat(timespec="seconds")),
        )
        row_id = int(cur.lastrowid)
    return row_id


def get_history(
    limit: int = 20,
    q: str = "",
    prediction: str = "",
) -> list[dict]:
    """
    Return the most recent analysis records (newest first).

    ``q`` does a substring search on the URL; ``prediction`` filters by
    'phishing' / 'legitimate'.
    """
    sql = (
        "SELECT url, prediction, risk_score, risk_level, created_at, "
        "model, analysis_id FROM analyses"
    )
    clauses: list[str] = []
    params: list = []
    if q:
        clauses.append("url LIKE ?")
        params.append(f"%{q}%")
    if prediction in ("phishing", "legitimate"):
        clauses.append("prediction = ?")
        params.append(prediction)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(int(limit))

    with _conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {
            "url": r[0],
            "prediction": r[1],
            "risk_score": r[2],
            "risk_level": r[3],
            "created_at": r[4],
            "model": r[5] or "",
            "analysis_id": r[6] or "",
        }
        for r in rows
    ]


def delete_analysis(analysis_id: str) -> bool:
    """Delete one analysis by its public analysis_id. Returns True if removed."""
    with _conn() as conn:
        cur = conn.execute("DELETE FROM analyses WHERE analysis_id = ?", (str(analysis_id),))
        return cur.rowcount > 0


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
        high_risk = conn.execute(
            "SELECT COUNT(*) FROM analyses WHERE risk_level IN ('HIGH', 'CRITICAL')"
        ).fetchone()[0]

    avg = round(float(avg), 4) if avg is not None else 0.0
    return {
        "total_analyzed": int(total),
        "phishing_detected": int(phish),
        "legitimate_detected": int(legit),
        "high_risk_analyses": int(high_risk),
        "average_risk_score": avg,
        "average_risk_percent": round(avg * 100, 1),
    }


def clear_history() -> int:
    """Empty the analysis table (used by the UI reset button)."""
    with _conn() as conn:
        cur = conn.execute("DELETE FROM analyses")
        return int(cur.rowcount or 0)