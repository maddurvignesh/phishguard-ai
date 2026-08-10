"""
Tests for the trained model and the inference service (ml/model.py).
"""

from __future__ import annotations

import pytest

from ml.feature_extractor import FEATURE_COLUMNS
from ml.model import ModelNotReadyError, get_model, load_model


def test_model_and_metadata_load():
    """The trained artifact must exist and produce a well-formed prediction."""
    model, meta = load_model()
    assert meta["model_name"] in {"Random Forest", "XGBoost", "Decision Tree",
                                  "Logistic Regression"}
    assert meta["feature_columns"] == FEATURE_COLUMNS


def test_predict_shape_for_legit_url():
    r = get_model().predict("https://www.google.com")
    expected_keys = {
        "prediction", "probability", "confidence", "risk_score",
        "risk_level", "features", "security_analysis", "explanation",
    }
    assert expected_keys <= set(r.keys())
    assert r["prediction"] in {"legitimate", "phishing"}
    assert 0.0 <= r["probability"] <= 1.0


def test_predict_obvious_phishing_pattern():
    r = get_model().predict(
        "https://paypal.com-usa.security.confirm-login.verify.cgi.webscr/login"
    )
    assert r["prediction"] == "phishing"
    assert r["risk_score"] > 0.5


def test_probability_powers_risk_score():
    r = get_model().predict("https://example.com")
    # risk_score is probability rounded for display; allow small rounding drift.
    assert abs(r["risk_score"] - r["probability"]) < 1e-3


def test_security_analysis_cards_present():
    r = get_model().predict("http://192.168.1.1/secure/verify.php")
    assert len(r["security_analysis"]) >= 6
    for card in r["security_analysis"]:
        assert card["status"] in {"safe", "warning", "suspicious"}
        assert card["feature"]


def test_explanation_is_data_driven():
    r = get_model().predict("https://tinyurl.com/abc123-def")
    # TinyURL is a shortener: the explanation should mention relevant signals,
    # and each item must carry the typical legitimate value for honesty.
    for item in r["explanation"]:
        assert "typical_legit" in item
        assert "value" in item


def test_model_loading_error_message_when_missing(monkeypatch, tmp_path):
    import ml.model as module

    fake = tmp_path / "models"
    (fake).mkdir()
    monkeypatch.setattr(module, "MODEL_PATH", fake / "nonexistent.joblib")
    monkeypatch.setattr(module, "META_PATH", fake / "nonexistent.json")
    with pytest.raises(ModelNotReadyError) as exc:
        module.load_model()
    assert "ml.train" in str(exc.value)