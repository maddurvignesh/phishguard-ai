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


def test_predict_includes_analysis_fields(client):
    """New signature fields: analysis_id, dynamic model name, anatomy, threat DNA."""
    r = client.post("/api/v1/predict", json={"url": "https://example.com"})
    body = r.json()
    assert body["analysis_id"].startswith("PG-")
    assert body["model_name"]  # dynamic, not hardcoded
    assert body["url_anatomy"]["components"]
    assert set(body["url_anatomy"]["components"][0]) >= {"name", "value", "suspicious", "note"}
    assert "URL Complexity" in body["threat_dna"]["categories"]


def test_predict_with_specific_model(client):
    """Model Playground endpoint: every deployed model returns a real result."""
    for name in ("Logistic Regression", "Decision Tree", "Random Forest", "XGBoost"):
        r = client.post(f"/api/v1/predict/model/{name}", json={"url": "https://example.com"})
        assert r.status_code == 200
        body = r.json()
        assert body["model_name"] == name
        assert body["prediction"] in ("legitimate", "phishing")


def test_predict_with_unknown_model_rejected(client):
    r = client.post("/api/v1/predict/model/NotAModel", json={"url": "https://example.com"})
    assert r.status_code == 400


def test_simulate_is_hypothetical(client):
    """What-if: scoring an edited feature vector returns a hypothetical flag."""
    features = {"url_length": 200, "num_subdomains": 5,
                "suspicious_keywords_count": 4, "has_https": 0}
    r = client.post("/api/v1/predict/simulate",
                    json={"features": features, "model": "Random Forest"})
    assert r.status_code == 200
    body = r.json()
    assert body["hypothetical"] is True
    assert body["prediction"] in ("legitimate", "phishing")
    assert body["model_name"] == "Random Forest"


def test_model_health_and_models(client):
    h = client.get("/api/v1/model-health").json()
    assert h["status"] == "READY"
    assert h["model_name"] == "Random Forest"
    assert h["num_features"] >= 25

    m = client.get("/api/v1/models").json()
    names = [x["name"] for x in m["models"]]
    assert "Random Forest" in names
    assert m["best_model"] == "Random Forest"


def test_history_search_filter_and_delete(client):
    client.post("/api/v1/predict", json={"url": "https://github.com"})
    client.post("/api/v1/predict", json={"url": "https://paypal-verify-login.webscr.example/"})

    found = client.get("/api/v1/history", params={"q": "github"}).json()["results"]
    assert found and all("github" in r["url"] for r in found)

    phish = client.get("/api/v1/history", params={"prediction": "phishing"}).json()["results"]
    assert all(r["prediction"] == "phishing" for r in phish)

    target = client.get("/api/v1/history").json()["results"][0]
    if target["analysis_id"]:
        d = client.delete(f"/api/v1/history/{target['analysis_id']}")
        assert d.status_code == 200