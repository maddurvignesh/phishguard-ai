"""
main.py — PhishGuard AI FastAPI application entry point.

Run from the project root:

    uvicorn backend.app.main:app --reload

The trained model is loaded ONCE at startup (lifespan) and shared across all
requests — it is never retrained per request (see ml/model.py).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import APP_NAME, APP_VERSION, CORS_ORIGINS, EVALUATION_DIR
from .routes import health, predict, stats
from ml.model import ModelNotReadyError, get_model


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the trained model into memory exactly once, before any request.
    try:
        get_model().load()
        print(f"[PhishGuard] Model loaded: {get_model().model_name}")
    except ModelNotReadyError as exc:
        # The app still boots so the API can answer /health; predict returns a
        # clear 503 telling the developer to run the training pipeline.
        print(f"[PhishGuard] WARNING: {exc}")
    yield


app = FastAPI(
    title=f"{APP_NAME} API",
    description=(
        "Intelligent phishing-website detection. POST a URL string and receive "
        "a machine-learning risk assessment. URLs are analysed as text only — "
        "the app never visits websites."
    ),
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Training charts served as static assets (used by the report / demo).
EVALUATION_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/evaluation", StaticFiles(directory=str(EVALUATION_DIR)), name="evaluation")

app.include_router(health.router, prefix="/api/v1", tags=["system"])
app.include_router(predict.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def root():
    return {
        "app": APP_NAME,
        "message": "PhishGuard AI API is running. See /docs for the interactive API.",
        "endpoints": [
            "POST /api/v1/predict",
            "GET  /api/v1/model-info",
            "GET  /api/v1/statistics",
            "GET  /api/v1/history",
            "GET  /api/v1/health",
        ],
    }