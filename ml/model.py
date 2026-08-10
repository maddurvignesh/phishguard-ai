"""
============================================================================
 model.py — inference service (load-once, predict-on-demand)
============================================================================
 PhishGuard AI
----------------------------------------------------------------------------
 This module is the bridge between the trained model and the web API.

 Responsibilities
 ----------------
 1. Load the serialized best model + metadata ONCE at server startup and
    cache them for the lifetime of the process (never retrained per request).
 2. Expose ``predict(url)`` which reuses the exact same feature extractor
    that built the training matrix  (see ml/feature_extractor.py).
 3. Convert the raw probability into the user-facing prediction, risk score,
    risk level, confidence and an honest, data-driven explanation.

 SECURITY NOTE
 -------------
 The URL is treated ONLY as text. We never visit the website, never open the
 network socket, never download anything. This is a defensive tool.
============================================================================
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np

from ml.feature_extractor import FEATURE_COLUMNS, extract_features

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "models" / "phishguard_model.joblib"
META_PATH = PROJECT_ROOT / "models" / "model_meta.json"
RESULTS_PATH = PROJECT_ROOT / "ml" / "evaluation" / "model_results.json"

#: Human-friendly labels for the two classes.
CLASS_LABELS = {0: "legitimate", 1: "phishing"}
CLASS_EMOJI = {0: "LEGITIMATE", 1: "PHISHING"}


class ModelNotReadyError(RuntimeError):
    """Raised when the model has not been trained yet."""


def load_model() -> tuple[object, dict]:
    """
    Deserialize the trained model and its metadata.

    Returns:
        (estimator, meta_dict)

    Raises:
        ModelNotReadyError: if the model or metadata file is absent/corrupt,
            with a friendly message telling the developer how to fix it.
    """
    if not MODEL_PATH.exists() or not META_PATH.exists():
        raise ModelNotReadyError(
            "Trained model not found. Run the training pipeline first:\n\n"
            "    python -m ml.train\n\n"
            "This trains the models, evaluates them and saves the best "
            "classifier to models/phishguard_model.joblib"
        )
    try:
        estimator = joblib.load(MODEL_PATH)
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    except Exception as exc:  # corrupted file, bad pickle, wrong schema...
        raise ModelNotReadyError(
            f"Could not load the trained model ({exc}). Please re-run "
            "`python -m ml.train` to regenerate it."
        ) from exc
    return estimator, meta


def _risk_level(probability: float, risk_levels: list[dict]) -> dict:
    """
    Map a probability (0..1) onto LOW / MEDIUM / HIGH / CRITICAL.

    Using the encoded thresholds from training (0-0.3 LOW, 0.3-0.6 MEDIUM,
    0.6-0.8 HIGH, 0.8-1.0 CRITICAL). This is a UX grouping of the model's
    single probability — NOT an independent guarantee.
    """
    for level in sorted(risk_levels, key=lambda x: x["max"], reverse=True):
        if probability >= level["max"]:
            return level
    return risk_levels[0]


# ---------------------------------------------------------------------------
# URL security analysis (rule-based "feature cards")
# ---------------------------------------------------------------------------
def security_analysis(features: dict, extra: dict) -> list[dict]:
    """
    Produce the per-feature verdict cards shown on the result page.

    These are transparent, human-legible rules computed on the *extracted
    features* (the same features the model saw). Each card has: a title,
    a status in {safe, warning, suspicious}, a short message and the raw
    observed value. Nothing here is fabricated — it is either true of the
    URL or derived from the model's own probability.
    """
    url_len = features["url_length"]
    kw = features["suspicious_keywords_count"]

    def _len_status(v, warn, susp):
        return "safe" if v <= warn else ("warning" if v <= susp else "suspicious")

    cards = [
        {
            "feature": "HTTPS / Encryption",
            "status": "safe" if features["has_https"] else "warning",
            "icon": "lock",
            "message": (
                "URL uses HTTPS (encrypted connection)."
                if features["has_https"]
                else "URL uses HTTP — no encryption, a common phishing cue."
            ),
            "value": "https" if features["has_https"] else "http",
        },
        {
            "feature": "Suspicious keywords",
            "status": "safe" if kw == 0 else ("warning" if kw <= 2 else "suspicious"),
            "icon": "keywords",
            "message": (
                "No phishing-related keywords found."
                if kw == 0
                else f"{kw} suspicious word(s) such as login/verify/secure/account."
            ),
            "value": str(kw),
        },
        {
            "feature": "Raw IP address",
            "status": "suspicious" if features["has_ip_address"] else "safe",
            "icon": "ip",
            "message": (
                "Host is a raw IP address — legitimate sites rarely use raw IPs in "
                "branded URLs."
                if features["has_ip_address"]
                else "Host uses a readable domain name, not a raw IP."
            ),
            "value": "yes" if features["has_ip_address"] else "no",
        },
        {
            "feature": "Subdomains",
            "status": _len_status(features["num_subdomains"], 1, 3),
            "icon": "subdomains",
            "message": (
                f"{features['num_subdomains']} subdomain level(s) detected — "
                "excessive nesting can hide the true owner."
            ),
            "value": str(features["num_subdomains"]),
        },
        {
            "feature": "URL length",
            "status": _len_status(url_len, 75, 150),
            "icon": "length",
            "message": (
                f"URL is {url_len} characters long; very long URLs are harder to "
                "inspect and more common in phishing."
            ),
            "value": f"{url_len} chars",
        },
        {
            "feature": "URL shortener",
            "status": "suspicious" if features["is_shortened"] else "safe",
            "icon": "shortener",
            "message": (
                "URL belongs to a link-shortening service — the destination is hidden "
                "from the victim."
                if features["is_shortened"]
                else "URL is not a known link shortener."
            ),
            "value": "shared" if features["is_shortened"] else "direct",
        },
        {
            "feature": "Special characters",
            "status": _len_status(features["num_special_chars"], 15, 30),
            "icon": "special",
            "message": (
                f"{features['num_special_chars']} non-alphanumeric characters "
                "(@, %, =, &, ...) — issue when high."
            ),
            "value": str(features["num_special_chars"]),
        },
        {
            "feature": "Top-level domain",
            "status": "warning" if features["tld_is_suspicious"] else "safe",
            "icon": "tld",
            "message": (
                "TLD is a free/abused extension (.xyz, .top ...) often used for "
                "throwaway phishing sites."
                if features["tld_is_suspicious"]
                else "TLD is a common extension."
            ),
            "value": features.get("_tld") or "—",
        },
    ]
    return cards


# ---------------------------------------------------------------------------
# Explanation ("why was this flagged?")
# ---------------------------------------------------------------------------
def explain(features: dict, meta: dict, n: int = 5) -> list[dict]:
    """
    Data-driven explanation of the prediction.

    Uses the *model's own* feature importances and the real per-class feature
    statistics stored during training. For the top-N most important features
    we answer: does this URL sit closer to the typical *phishing* sample than
    to the typical *legitimate* sample?

    Returns a list of dicts: {feature, value, typical_legit, direction, signal}
    where `direction` mirrors the observed value vs the legitimate class mean.
    """
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
        x = features[col]
        std = stds.get(col, 1.0) or 1.0
        lm = legit_m.get(col, 0.0)
        pm = phish_m.get(col, 0.0)

        # How strongly does this URL deviate from the *legitimate* average?
        deviation = (x - lm) / std
        # Which direction does the deviation lean (towards the phishing mean)?
        leaning_to_phish = (pm - lm) != 0 and (
            np.sign(x - lm) == np.sign(pm - lm)
        )
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
    out = []
    for r in ranked[:n]:
        out.append({
            "feature": labels.get(r["feature"], r["feature"]),
            "value": r["value"],
            "typical_legit": r["typical_legit"],
            "typical_phish": r["typical_phish"],
            "direction": r["direction"],
        })
    return out


# ---------------------------------------------------------------------------
# The public inference API
# ---------------------------------------------------------------------------
class ModelManager:
    """Lightweight singleton holding the loaded model and metadata."""

    def __init__(self) -> None:
        self.model = None
        self.meta: dict = {}

    def load(self) -> None:
        """Load (or reload) model + metadata into memory."""
        self.model, self.meta = load_model()

    @property
    def ready(self) -> bool:
        return self.model is not None

    @property
    def model_name(self) -> str:
        return self.meta.get("model_name", "unknown")

    @property
    def risk_levels(self) -> list[dict]:
        return self.meta.get("risk_levels", [{"max": 0.0, "label": "LOW", "description": ""}])

    def predict(self, raw_url: str) -> dict:
        """
        Run the trained model on one URL.

        Returns a complete, frontend-ready result:
            prediction, probability, risk_score, risk_level, confidence,
            features, security_analysis, explanation.
        """
        if not self.ready:
            self.load()

        features = extract_features(raw_url)
        # Build a named DataFrame so sklearn does not warn about missing
        # feature names (the model was fitted on the same column order).
        import pandas as pd

        X = pd.DataFrame(
            [[features[c] for c in FEATURE_COLUMNS]],
            columns=FEATURE_COLUMNS,
            dtype=float,
        )

        proba = float(self.model.predict_proba(X)[0, 1])  # P(phishing)
        label = int(round(proba))                          # threshold 0.5
        confidence = max(proba, 1.0 - proba)

        risk_levels = self.risk_levels if self.risk_levels else []
        if not risk_levels:
            risk_levels = [
                {"max": 0.0, "label": "LOW", "description": ""},
                {"max": 0.3, "label": "MEDIUM", "description": ""},
                {"max": 0.6, "label": "HIGH", "description": ""},
                {"max": 0.8, "label": "CRITICAL", "description": ""},
            ]
        level = _risk_level(proba, risk_levels)

        # Attach the actual TLD for nice display on the security cards.
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
            "prediction": CLASS_LABELS[label],
            "label": label,
            "probability": round(proba, 6),
            "risk_score": round(proba, 4),            # 0..1, mirrors probability
            "risk_score_percent": round(proba * 100, 1),
            "confidence": round(confidence, 6),
            "confidence_percent": round(confidence * 100, 1),
            "risk_level": level["label"],
            "risk_description": level.get("description", ""),
            "features": features,
            "security_analysis": security_analysis(features, display_features),
            "explanation": explain(features, self.meta),
        }


# Module-level singleton so the API can import one shared instance.
manager = ModelManager()


def get_model() -> ModelManager:
    """Return the cached shared ModelManager (loads on first use)."""
    return manager