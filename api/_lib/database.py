"""
database.py — In-memory analysis history for Vercel serverless.

Since Vercel serverless functions are ephemeral, we use in-memory storage.
History will be lost on cold starts, but this is acceptable for a demo.
For production, use Turso/PlanetScale/Vercel Postgres.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone

_lock = threading.Lock()
_analyses: list[dict] = []
_next_id: int = 1


def record_analysis(
    url: str,
    prediction: str,
    risk_score: float,
    risk_level: str,
    model: str = "",
    analysis_id: str = "",
) -> int:
    global _next_id
    with _lock:
        entry = {
            "id": _next_id,
            "analysis_id": analysis_id,
            "url": url[:500],
            "prediction": prediction,
            "risk_score": float(risk_score),
            "risk_level": risk_level,
            "model": model,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        _analyses.append(entry)
        _next_id += 1
        return entry["id"]


def get_history(
    limit: int = 20,
    q: str = "",
    prediction: str = "",
) -> list[dict]:
    with _lock:
        results = list(reversed(_analyses))

    if q:
        q_lower = q.lower()
        results = [r for r in results if q_lower in r["url"].lower()]

    if prediction in ("phishing", "legitimate"):
        results = [r for r in results if r["prediction"] == prediction]

    return results[:limit]


def delete_analysis(analysis_id: str) -> bool:
    with _lock:
        for i, entry in enumerate(_analyses):
            if entry["analysis_id"] == analysis_id:
                _analyses.pop(i)
                return True
    return False


def get_statistics() -> dict:
    with _lock:
        total = len(_analyses)
        phish = sum(1 for a in _analyses if a["prediction"] == "phishing")
        legit = sum(1 for a in _analyses if a["prediction"] == "legitimate")
        high_risk = sum(1 for a in _analyses if a["risk_level"] in ("HIGH", "CRITICAL"))
        avg = sum(a["risk_score"] for a in _analyses) / total if total else 0.0

    return {
        "total_analyzed": total,
        "phishing_detected": phish,
        "legitimate_detected": legit,
        "high_risk_analyses": high_risk,
        "average_risk_score": round(avg, 4),
        "average_risk_percent": round(avg * 100, 1),
    }


def clear_history() -> int:
    global _next_id
    with _lock:
        count = len(_analyses)
        _analyses.clear()
        _next_id = 1
        return count
