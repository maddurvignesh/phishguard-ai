"""
stats.py — GET /model-info, GET /statistics, GET /history.

All numbers come from the real training results (model_results.json) and the
real SQLite history table.  Nothing is hardcoded or faked.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..config import load_results
from ..database import clear_history, get_history, get_statistics

router = APIRouter(tags=["analytics"])


@router.get("/model-info", summary="Training summary and evaluation metrics")
def model_info():
    """Everything the Model Insights dashboard needs, straight from training."""
    results = load_results()
    if not results:
        raise HTTPException(
            status_code=404,
            detail="No training results found. Run `python -m ml.train` first.",
        )
    return {
        "dataset": results.get("dataset"),
        "best_model": results.get("best_model"),
        "best_metrics": results.get("best_metrics"),
        "models": results.get("models"),
        "feature_importance": results.get("feature_importance"),
        "test_size": results.get("test_size"),
        "train_size": results.get("train_size"),
    }


@router.get("/statistics", summary="Dashboard statistics (from local history)")
def statistics():
    """Totals about the analyses performed in this installation."""
    return get_statistics()


@router.get("/history", summary="Recent analysis history")
def history(limit: int = 20):
    """The most recent analyses, newest first."""
    return {"results": get_history(limit=min(max(limit, 1), 100))}


@router.delete("/history", summary="Clear the analysis history")
def clear_history_endpoint():
    """Delete all locally stored analysis records."""
    return {"cleared": clear_history()}