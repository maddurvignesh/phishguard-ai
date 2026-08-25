"""
model.py — ModelManager adapted for Vercel serverless functions.

The model is loaded once per cold start and cached across warm invocations.
"""

from __future__ import annotations

import json
import os
import secrets
from pathlib import Path

import joblib
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# Try compressed models first (for Vercel), fallback to original
_MODEL_COMPRESSED = PROJECT_ROOT / "models" / "phishguard_model_compressed.joblib"
_MODEL_ORIGINAL = PROJECT_ROOT / "models" / "phishguard_model.joblib"
MODEL_PATH = _MODEL_COMPRESSED if _MODEL_COMPRESSED.exists() else _MODEL_ORIGINAL

_ALL_MODELS_COMPRESSED = PROJECT_ROOT / "models" / "all_models_compressed.joblib"
_ALL_MODELS_ORIGINAL = PROJECT_ROOT / "models" / "all_models.joblib"
ALL_MODELS_PATH = _ALL_MODELS_COMPRESSED if _ALL_MODELS_COMPRESSED.exists() else _ALL_MODELS_ORIGINAL

META_PATH = PROJECT_ROOT / "models" / "model_meta.json"
RESULTS_PATH = PROJECT_ROOT / "ml" / "evaluation" / "model_results.json"

CLASS_LABELS = {0: "legitimate", 1: "phishing"}


class ModelNotReadyError(RuntimeError):
    pass


def load_model() -> tuple[object, dict]:
    if not MODEL_PATH.exists() or not META_PATH.exists():
        raise ModelNotReadyError(
            "Trained model not found. Run `python -m ml.train` first."
        )
    try:
        estimator = joblib.load(MODEL_PATH)
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ModelNotReadyError(f"Could not load model: {exc}") from exc
    return estimator, meta


def load_results() -> dict:
    if not RESULTS_PATH.exists():
        return {}
    return json.loads(RESULTS_PATH.read_text(encoding="utf-8"))


def _risk_level(probability: float, risk_levels: list[dict]) -> dict:
    for level in sorted(risk_levels, key=lambda x: x["max"], reverse=True):
        if probability >= level["max"]:
            return level
    return risk_levels[0]


def security_analysis(features: dict, extra: dict) -> list[dict]:
    url_len = features["url_length"]
    kw = features["suspicious_keywords_count"]

    def _len_status(v, warn, susp):
        return "safe" if v <= warn else ("warning" if v <= susp else "suspicious")

    return [
        {
            "feature": "HTTPS / Encryption",
            "status": "safe" if features["has_https"] else "warning",
            "icon": "lock",
            "message": "URL uses HTTPS (encrypted connection)." if features["has_https"] else "URL uses HTTP — no encryption, a common phishing cue.",
            "value": "https" if features["has_https"] else "http",
        },
        {
            "feature": "Suspicious keywords",
            "status": "safe" if kw == 0 else ("warning" if kw <= 2 else "suspicious"),
            "icon": "keywords",
            "message": "No phishing-related keywords found." if kw == 0 else f"{kw} suspicious word(s) such as login/verify/secure/account.",
            "value": str(kw),
        },
        {
            "feature": "Raw IP address",
            "status": "suspicious" if features["has_ip_address"] else "safe",
            "icon": "ip",
            "message": "Host is a raw IP address — legitimate sites rarely use raw IPs in branded URLs." if features["has_ip_address"] else "Host uses a readable domain name, not a raw IP.",
            "value": "yes" if features["has_ip_address"] else "no",
        },
        {
            "feature": "Subdomains",
            "status": _len_status(features["num_subdomains"], 1, 3),
            "icon": "subdomains",
            "message": f"{features['num_subdomains']} subdomain level(s) detected — excessive nesting can hide the true owner.",
            "value": str(features["num_subdomains"]),
        },
        {
            "feature": "URL length",
            "status": _len_status(url_len, 75, 150),
            "icon": "length",
            "message": f"URL is {url_len} characters long; very long URLs are harder to inspect and more common in phishing.",
            "value": f"{url_len} chars",
        },
        {
            "feature": "URL shortener",
            "status": "suspicious" if features["is_shortened"] else "safe",
            "icon": "shortener",
            "message": "URL belongs to a link-shortening service — the destination is hidden from the victim." if features["is_shortened"] else "URL is not a known link shortener.",
            "value": "shared" if features["is_shortened"] else "direct",
        },
        {
            "feature": "Special characters",
            "status": _len_status(features["num_special_chars"], 15, 30),
            "icon": "special",
            "message": f"{features['num_special_chars']} non-alphanumeric characters (@, %, =, &, ...) — issue when high.",
            "value": str(features["num_special_chars"]),
        },
        {
            "feature": "Top-level domain",
            "status": "warning" if features["tld_is_suspicious"] else "safe",
            "icon": "tld",
            "message": "TLD is a free/abused extension (.xyz, .top ...) often used for throwaway phishing sites." if features["tld_is_suspicious"] else "TLD is a common extension.",
            "value": features.get("_tld") or "—",
        },
    ]


def explain(features: dict, meta: dict, n: int = 5) -> list[dict]:
    try:
        from ml.feature_extractor import FEATURE_COLUMNS
    except ImportError:
        FEATURE_COLUMNS = list(features.keys())

    try:
        stats = meta["class_stats"]
        imp = {i["name"]: i["importance"] for i in meta["feature_importance"]}
        legit_m = stats["legit_means"]
        phish_m = stats["phish_means"]
        stds = stats["stds"]
    except (KeyError, TypeError):
        return []

    ranked = []
    for col in FEATURE_COLUMNS:
        importance = imp.get(col, 0.0)
        x = features.get(col, 0.0)
        std = stds.get(col, 1.0) or 1.0
        lm = legit_m.get(col, 0.0)
        pm = phish_m.get(col, 0.0)

        deviation = (x - lm) / std
        leaning_to_phish = (pm - lm) != 0 and (np.sign(x - lm) == np.sign(pm - lm))
        if not leaning_to_phish or abs(deviation) < 0.05:
            continue
        ranked.append({
            "feature": col,
            "value": float(x),
            "typical_legit": float(lm),
            "typical_phish": float(pm),
            "direction": "higher" if x > lm else "lower",
            "signal": float(importance) * abs(deviation),
        })

    ranked.sort(key=lambda r: r["signal"], reverse=True)
    labels = {
        "url_length": "URL length",
        "num_dots": "Number of dots",
        "num_subdomains": "Subdomain count",
        "suspicious_keywords_count": "Suspicious keywords",
        "has_ip_address": "Raw IP host",
        "has_https": "No HTTPS",
        "is_shortened": "URL shortener",
        "special_char_ratio": "Special-character ratio",
        "tld_is_suspicious": "Abusive TLD",
        "num_equals": "'=' characters",
        "num_at": "'@' characters",
        "path_length": "Path length",
        "query_length": "Query length",
    }
    return [
        {
            "feature": labels.get(r["feature"], r["feature"]),
            "value": r["value"],
            "typical_legit": r["typical_legit"],
            "typical_phish": r["typical_phish"],
            "direction": r["direction"],
        }
        for r in ranked[:n]
    ]


class ModelManager:
    def __init__(self):
        self.model = None
        self.meta: dict = {}
        self._all_models: dict | None = None

    def load(self):
        self.model, self.meta = load_model()

    def load_all(self) -> dict:
        if self._all_models is not None:
            return self._all_models
        if not self.ready:
            self.load()
        if not ALL_MODELS_PATH.exists():
            self._all_models = {self.model_name: self.model}
            return self._all_models
        try:
            self._all_models = joblib.load(ALL_MODELS_PATH)
        except Exception:
            self.load()
            self._all_models = {self.model_name: self.model}
        return self._all_models

    @property
    def ready(self) -> bool:
        return self.model is not None

    @property
    def model_name(self) -> str:
        return self.meta.get("model_name", "unknown")

    @property
    def models_available(self) -> list[str]:
        return self.meta.get("models_available") or list(self.load_all().keys())

    @property
    def risk_levels(self) -> list[dict]:
        return self.meta.get("risk_levels", [{"max": 0.0, "label": "LOW", "description": ""}])

    def _score(self, estimator, X) -> tuple[float, int]:
        proba = float(estimator.predict_proba(X)[0, 1])
        label = int(round(proba))
        return proba, label

    def _build_result(self, estimator, model_name: str, raw_url: str) -> dict:
        from ml.feature_extractor import FEATURE_COLUMNS, extract_features

        features = extract_features(raw_url)
        import pandas as pd

        X = pd.DataFrame(
            [[features[c] for c in FEATURE_COLUMNS]],
            columns=FEATURE_COLUMNS,
            dtype=float,
        )

        proba, label = self._score(estimator, X)
        confidence = max(proba, 1.0 - proba)

        risk_levels = self.risk_levels if self.risk_levels else [
            {"max": 0.0, "label": "LOW", "description": ""},
            {"max": 0.3, "label": "MEDIUM", "description": ""},
            {"max": 0.6, "label": "HIGH", "description": ""},
            {"max": 0.8, "label": "CRITICAL", "description": ""},
        ]
        level = _risk_level(proba, risk_levels)

        display_features = dict(features)
        try:
            from urllib.parse import urlparse
            from ml.feature_extractor import _tld_of, _hostname_of
            display_features["_tld"] = _tld_of(_hostname_of(urlparse(
                (("http://" + raw_url) if "://" not in raw_url else raw_url)
            )))
        except Exception:
            display_features["_tld"] = "—"

        return {
            "analysis_id": "PG-" + secrets.token_hex(6).upper(),
            "model_name": model_name,
            "prediction": CLASS_LABELS[label],
            "label": label,
            "probability": round(proba, 6),
            "risk_score": round(proba, 4),
            "risk_score_percent": round(proba * 100, 1),
            "confidence": round(confidence, 6),
            "confidence_percent": round(confidence * 100, 1),
            "risk_level": level["label"],
            "risk_description": level.get("description", ""),
            "features": features,
            "security_analysis": security_analysis(features, display_features),
            "explanation": explain(features, self.meta),
            "url_anatomy": _url_anatomy(raw_url),
            "threat_dna": _threat_dna(features, self.meta),
        }

    def predict(self, raw_url: str) -> dict:
        if not self.ready:
            self.load()
        return self._build_result(self.model, self.model_name, raw_url)

    def predict_with(self, model_name: str, raw_url: str) -> dict:
        if not self.ready:
            self.load()
        registry = self.load_all()
        if model_name not in registry:
            known = ", ".join(registry) or "none"
            raise ValueError(f"Model '{model_name}' is not available. Available: {known}.")
        return self._build_result(registry[model_name], model_name, raw_url)

    def score_features(self, features: dict, model_name: str = "") -> dict:
        if not self.ready:
            self.load()
        estimator = self.model
        effective_name = self.model_name
        if model_name:
            registry = self.load_all()
            if model_name not in registry:
                raise ValueError(f"Unknown model '{model_name}'.")
            estimator = registry[model_name]
            effective_name = model_name

        from ml.feature_extractor import FEATURE_COLUMNS
        import pandas as pd

        X = pd.DataFrame(
            [[float(features.get(c, 0.0)) for c in FEATURE_COLUMNS]],
            columns=FEATURE_COLUMNS,
            dtype=float,
        )
        proba, label = self._score(estimator, X)
        confidence = max(proba, 1.0 - proba)
        level = _risk_level(proba, self.risk_levels)

        return {
            "model_name": effective_name,
            "prediction": CLASS_LABELS[label],
            "label": label,
            "probability": round(proba, 6),
            "risk_score": round(proba, 4),
            "risk_score_percent": round(proba * 100, 1),
            "confidence_percent": round(confidence * 100, 1),
            "risk_level": level["label"],
            "risk_description": level.get("description", ""),
            "hypothetical": True,
        }


def _url_anatomy(url: str) -> dict:
    from urllib.parse import urlparse
    if "://" not in url:
        url = "http://" + url
    parsed = urlparse(url)
    return {
        "components": [
            {"name": "protocol", "value": parsed.scheme or "http"},
            {"name": "subdomain", "value": parsed.hostname.split(".")[0] if parsed.hostname and "." in parsed.hostname else ""},
            {"name": "domain", "value": parsed.hostname or ""},
            {"name": "path", "value": parsed.path or "/"},
            {"name": "query", "value": parsed.query or ""},
        ]
    }


def _threat_dna(features: dict, meta: dict) -> dict:
    categories = {}
    if features.get("suspicious_keywords_count", 0) > 0:
        categories["Keyword Suspicion"] = min(features["suspicious_keywords_count"] * 25, 100)
    if features.get("has_ip_address"):
        categories["IP Address"] = 100
    if features.get("is_shortened"):
        categories["URL Shortener"] = 100
    if features.get("tld_is_suspicious"):
        categories["Suspicious TLD"] = 75
    if features.get("num_subdomains", 0) > 2:
        categories["Subdomain Abuse"] = min(features["num_subdomains"] * 20, 100)
    if not categories:
        categories["Low Risk"] = 10
    return {"categories": categories}


manager = ModelManager()


def get_model() -> ModelManager:
    return manager
