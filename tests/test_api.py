"""
Tests for the FastAPI endpoints (backend/app).
Uses FastAPI's TestClient against the real application.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app import database
from backend.app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Isolate history storage for each test.
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


def test_predict_legit_url(client):
    r = client.post("/api/v1/predict", json={"url": "https://example.com"})
    assert r.status_code == 200
    body = r.json()
    assert body["prediction"] in {"legitimate", "phishing"}
    assert "risk_score" in body
    assert "risk_level" in body
    assert "security_analysis" in body
    assert body["url"] == "https://example.com"


def test_predict_invalid_empty_url(client):
    r = client.post("/api/v1/predict", json={"url": ""})
    assert r.status_code == 422  # pydantic min_length


def test_predict_whitespace_rejected(client):
    r = client.post("/api/v1/predict", json={"url": "https://exa mple.com"})
    assert r.status_code == 400
    assert "whitespace" in r.json()["detail"]


def test_predict_too_long_url(client):
    bad = "https://example.com/" + "a" * 3000
    r = client.post("/api/v1/predict", json={"url": bad})
    assert r.status_code == 422


def test_model_info_returns_real_metrics(client):
    r = client.get("/api/v1/model-info")
    assert r.status_code == 200
    body = r.json()
    assert body["best_model"] == "Random Forest"
    assert "Random Forest" in body["models"]
    for metric in ("accuracy", "precision", "recall", "f1", "roc_auc"):
        assert metric in body["models"]["Random Forest"]["metrics"]
    assert len(body["feature_importance"]) >= 25


def test_statistics_and_history(client):
    client.post("/api/v1/predict", json={"url": "https://github.com"})
    client.post("/api/v1/predict", json={"url": "https://paypal-verify-login.webscr.example/"})

    stats = client.get("/api/v1/statistics").json()
    assert stats["total_analyzed"] >= 2
    assert stats["phishing_detected"] + stats["legitimate_detected"] == stats["total_analyzed"]

    hist = client.get("/api/v1/history").json()["results"]
    assert len(hist) >= 2
    first = hist[0]
    assert {"url", "prediction", "risk_score", "risk_level", "created_at"} <= set(first)


def test_predict_response_format_matches_spec(client):
    """POST /predict must return prediction, risk_score and features per spec."""
    r = client.post("/api/v1/predict", json={"url": "https://example.com"})
    body = r.json()
    assert body["prediction"] in ("legitimate", "phishing")
    assert "risk_score" in body
    assert "features" in body
    assert isinstance(body["risk_score"], (int, float))