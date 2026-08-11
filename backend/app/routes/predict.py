"""
predict.py — POST /predict (and a small batch variant).

The URL is validated defensively, feature-extracted with the exact same
code used during training, and scored by the trained model.  The URL string
is never visited, crawled or executed — it is treated purely as text.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from ..config import MAX_URL_LENGTH
from ..database import record_analysis
from ..schemas import FeatureSimulationInput, URLInput
from ml.model import ModelNotReadyError, get_model

router = APIRouter(tags=["prediction"])

_INVALID_CHARS = re.compile(r"[\s]")
_PROTOCOL_OK = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")

#: Characters we accept anywhere in a URL (everything else is rejected).
_ALLOWED = re.compile(
    r"^[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%\x00-\x7F]*$"
)


def validate_url(url: str) -> str:
    """
    Validate and lightly normalize a user-supplied URL.

    Returns:
        The trimmed URL.

    Raises:
        HTTPException(400): with a friendly, specific message.
    """
    if url is None:
        raise HTTPException(status_code=400, detail="Please enter a website URL.")
    url = url.strip()

    if not url:
        raise HTTPException(status_code=400, detail="Please enter a website URL.")

    if len(url) < 4:
        raise HTTPException(
            status_code=400, detail="That URL is too short to be a valid website address."
        )

    if len(url) > MAX_URL_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"URL is too long (maximum {MAX_URL_LENGTH} characters).",
        )

    if _INVALID_CHARS.search(url):
        raise HTTPException(
            status_code=400,
            detail="URL contains whitespace. Please enter one clean website address.",
        )

    if not _ALLOWED.match(url):
        raise HTTPException(
            status_code=400,
            detail="URL contains unsupported characters. Please enter a plain website address.",
        )

    return url


@router.post("/predict", summary="Analyze one URL")
def predict_url(payload: URLInput):
    """
    Predict whether ``payload.url`` is legitimate or phishing.

    Returns the full model output: prediction, probability, risk score,
    risk level, confidence, extracted features, a security analysis and a
    data-driven explanation.
    """
    url = validate_url(payload.url)

    model = get_model()
    try:
        result = model.predict(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    result["url"] = url
    record_analysis(
        url=url,
        prediction=result["prediction"],
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        model=result.get("model_name", ""),
        analysis_id=result.get("analysis_id", ""),
    )
    return result


@router.post("/predict/simulate", summary="Score a hypothetical feature vector (What-if)")
def simulate_features(payload: FeatureSimulationInput):
    """
    What-if analysis: score an edited *feature vector* with a real model.

    This is a controlled ML simulation for education/demonstration — it does
    NOT re-analyse a real URL and never claims to modify a website. The
    response is flagged ``"hypothetical": true``.
    """
    try:
        result = get_model().score_features(payload.features, payload.model or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


@router.post("/predict/model/{model_name}", summary="Analyze one URL with a specific model")
def predict_with_model(model_name: str, payload: URLInput):
    """
    Model Playground: run the same URL through one explicitly chosen model
    (Logistic Regression / Decision Tree / Random Forest / XGBoost).

    The output format is identical to ``/predict``; only the model differs.
    """
    url = validate_url(payload.url)
    try:
        result = get_model().predict_with(model_name, url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    result["url"] = url
    record_analysis(
        url=url,
        prediction=result["prediction"],
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        model=result.get("model_name", ""),
        analysis_id=result.get("analysis_id", ""),
    )
    return result


@router.post("/predict/batch", summary="Analyze up to 50 URLs")
def predict_batch(payload: list[URLInput]):
    """Batch variant: analyze several URLs and return a list of results."""
    outputs = []
    for item in payload:
        url = validate_url(item.url)
        try:
            result = get_model().predict(url)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        result["url"] = url
        record_analysis(
            url=url,
            prediction=result["prediction"],
            risk_score=result["risk_score"],
            risk_level=result["risk_level"],
            model=result.get("model_name", ""),
            analysis_id=result.get("analysis_id", ""),
        )
        outputs.append(result)
    return {"results": outputs}