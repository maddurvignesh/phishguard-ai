"""
stats.py — GET /model-info, /models, /model-health, /statistics, /history.

All numbers come from the real training results (model_results.json), the
trained artifacts and the real SQLite history table.  Nothing is hardcoded.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..config import load_results
from ..database import clear_history, get_history, get_statistics
from ml.model import get_model

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


@router.get("/models", summary="List available models and their test metrics")
def list_models():
    """Which models are deployed (for the Model Playground) plus real metrics."""
    results = load_results()
    manager = get_model()
    available = manager.models_available
    if not results:
        return {"models": [{"name": n, "available": n in available}
                           for n in manager.models_available],
                "best_model": manager.model_name}
    metrics = results.get("models", {})
    return {
        "best_model": results.get("best_model"),
        "models": [
            {
                "name": name,
                "available": name in available,
                "metrics": (metrics.get(name) or {}).get("metrics"),
            }
            for name in available
        ],
    }


@router.get("/model-health", summary="Model status, version and training info")
def model_health():
    """Everything the Model Health card needs."""
    manager = get_model()
    results = load_results()
    meta = manager.meta
    return {
        "model_loaded": manager.ready,
        "status": "READY" if manager.ready else "UNAVAILABLE",
        "model_name": manager.model_name,
        "model_version": meta.get("trained_at", "")[:10],
        "trained_at": meta.get("trained_at", ""),
        "random_state": meta.get("random_state"),
        "dataset_size": (results.get("dataset") or {}).get("rows_after_clean"),
        "num_features": len(meta.get("feature_columns") or []),
        "train_size": results.get("train_size"),
        "test_size": results.get("test_size"),
        "models_available": manager.models_available,
        "metrics": results.get("best_metrics"),
    }


@router.get("/statistics", summary="Dashboard statistics (from local history)")
def statistics():
    """Totals about the analyses performed in this installation."""
    return get_statistics()


@router.get("/history", summary="Recent analysis history")
def history(limit: int = 20, q: str = "", prediction: str = ""):
    """The most recent analyses, newest first, with optional search/filter."""
    return {"results": get_history(
        limit=min(max(limit, 1), 100),
        q=(q or "")[:200],
        prediction=(prediction or ""),
    )}


@router.delete("/history/{analysis_id}", summary="Delete one analysis")
def delete_one(analysis_id: str):
    """Remove a single analysis record by its public ID."""
    from ..database import delete_analysis
    if not delete_analysis(analysis_id):
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {"deleted": analysis_id}


@router.delete("/history", summary="Clear the analysis history")
def clear_history_endpoint():
    """Delete all locally stored analysis records."""
    return {"cleared": clear_history()}