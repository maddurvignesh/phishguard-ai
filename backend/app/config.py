"""
config.py — central configuration for the PhishGuard AI backend.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

MODEL_PATH = PROJECT_ROOT / "models" / "phishguard_model.joblib"
META_PATH = PROJECT_ROOT / "models" / "model_meta.json"
RESULTS_PATH = PROJECT_ROOT / "ml" / "evaluation" / "model_results.json"
EVALUATION_DIR = PROJECT_ROOT / "ml" / "evaluation"
DB_PATH = PROJECT_ROOT / "backend" / "phishguard.db"

APP_NAME = "PhishGuard AI"
APP_VERSION = "1.0.0"

#: Max length for a URL we are willing to analyze (defensive limit).
MAX_URL_LENGTH = 2048
MIN_URL_LENGTH = 4

#: Frontend dev server origins (Vite) — adjust when deploying.
#: Set the CORS_ORIGINS environment variable (comma-separated) to the deployed
#: frontend URL(s) to allow them on Render, e.g.
#:   CORS_ORIGINS=https://phishguard-frontend.onrender.com
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]
_env_origins = os.environ.get("CORS_ORIGINS", "").strip()
CORS_ORIGINS = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _DEFAULT_ORIGINS
)


def load_results() -> dict:
    """Load the training evaluation summary, or {} if missing."""
    if not RESULTS_PATH.exists():
        return {}
    return json.loads(RESULTS_PATH.read_text(encoding="utf-8"))