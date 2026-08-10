"""
health.py — GET /health
"""

from __future__ import annotations

from fastapi import APIRouter

from ..config import APP_NAME, APP_VERSION, MODEL_PATH, META_PATH, load_results
from ml.model import get_model

router = APIRouter(tags=["system"])


@router.get("/health", summary="Liveness probe")
def health():
    """Reports whether the API is up and whether the model is loaded."""
    model = get_model()
    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "model_loaded": model.ready,
        "model_name": model.model_name if model.ready else None,
        "dataset_ready": bool(load_results()),
    }