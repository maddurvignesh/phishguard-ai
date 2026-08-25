"""
index.py — Single Vercel serverless entry point for PhishGuard AI.

Consolidates all API routes into one function to avoid duplicating
large ML libraries across 10 separate functions.
"""

from __future__ import annotations

import re
import sys
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from api._lib.model import get_model, ModelNotReadyError, load_results
from api._lib.database import (
    record_analysis, get_history, clear_history,
    delete_analysis, get_statistics,
)

MAX_URL_LENGTH = 2048
_INVALID_CHARS = re.compile(r"[\s]")
_ALLOWED = re.compile(r"^[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%\x00-\x7F]*$")


def validate_url(url: str) -> str:
    if not url or not url.strip():
        raise ValueError("Please enter a website URL.")
    url = url.strip()
    if len(url) < 4:
        raise ValueError("That URL is too short to be a valid website address.")
    if len(url) > MAX_URL_LENGTH:
        raise ValueError(f"URL is too long (maximum {MAX_URL_LENGTH} characters).")
    if _INVALID_CHARS.search(url):
        raise ValueError("URL contains whitespace.")
    if not _ALLOWED.match(url):
        raise ValueError("URL contains unsupported characters.")
    return url


def _json_response(handler, status, data):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(json.dumps(data).encode())


def _read_body(handler):
    content_length = int(handler.headers.get("Content-Length", 0))
    if content_length > 0:
        return json.loads(handler.rfile.read(content_length))
    return {}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            path = self.path.split("?")[0]
            query = urlparse(self.path).query
            params = parse_qs(query)

            if path == "/api/v1/health":
                model = get_model()
                results = load_results()
                _json_response(self, 200, {
                    "status": "ok",
                    "app": "PhishGuard AI",
                    "version": "1.0.0",
                    "model_loaded": model.ready,
                    "model_name": model.model_name if model.ready else None,
                    "dataset_ready": bool(results),
                })

            elif path == "/api/v1/model-info":
                results = load_results()
                if not results:
                    _json_response(self, 404, {"detail": "No training results found."})
                    return
                _json_response(self, 200, {
                    "dataset": results.get("dataset"),
                    "best_model": results.get("best_model"),
                    "best_metrics": results.get("best_metrics"),
                    "models": results.get("models"),
                    "feature_importance": results.get("feature_importance"),
                    "test_size": results.get("test_size"),
                    "train_size": results.get("train_size"),
                })

            elif path == "/api/v1/models":
                results = load_results()
                manager = get_model()
                available = manager.models_available
                metrics = results.get("models", {}) if results else {}
                _json_response(self, 200, {
                    "best_model": results.get("best_model") if results else manager.model_name,
                    "models": [
                        {
                            "name": name,
                            "available": name in available,
                            "metrics": (metrics.get(name) or {}).get("metrics"),
                        }
                        for name in available
                    ],
                })

            elif path == "/api/v1/model-health":
                manager = get_model()
                results = load_results()
                meta = manager.meta
                _json_response(self, 200, {
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
                })

            elif path == "/api/v1/statistics":
                _json_response(self, 200, get_statistics())

            elif path == "/api/v1/history" or path.startswith("/api/v1/history"):
                limit = int(params.get("limit", ["20"])[0])
                q = params.get("q", [""])[0]
                prediction = params.get("prediction", [""])[0]
                _json_response(self, 200, {"results": get_history(
                    limit=min(max(limit, 1), 100),
                    q=q[:200],
                    prediction=prediction,
                )})

            else:
                _json_response(self, 404, {"detail": "Not found"})

        except Exception as e:
            _json_response(self, 500, {"detail": str(e)})

    def do_POST(self):
        try:
            path = self.path.split("?")[0]
            body = _read_body(self)

            if path == "/api/v1/predict":
                url = body.get("url", "")
                validated_url = validate_url(url)
                model = get_model()
                result = model.predict(validated_url)
                result["url"] = validated_url
                record_analysis(
                    url=validated_url,
                    prediction=result["prediction"],
                    risk_score=result["risk_score"],
                    risk_level=result["risk_level"],
                    model=result.get("model_name", ""),
                    analysis_id=result.get("analysis_id", ""),
                )
                _json_response(self, 200, result)

            elif path.startswith("/api/v1/predict/model/"):
                model_name = path.split("/predict/model/")[-1].replace("%20", " ")
                url = body.get("url", "")
                validated_url = validate_url(url)
                model = get_model()
                result = model.predict_with(model_name, validated_url)
                result["url"] = validated_url
                record_analysis(
                    url=validated_url,
                    prediction=result["prediction"],
                    risk_score=result["risk_score"],
                    risk_level=result["risk_level"],
                    model=result.get("model_name", ""),
                    analysis_id=result.get("analysis_id", ""),
                )
                _json_response(self, 200, result)

            elif path == "/api/v1/predict/simulate":
                features = body.get("features", {})
                model_name = body.get("model", "")
                model = get_model()
                result = model.score_features(features, model_name)
                _json_response(self, 200, result)

            elif path == "/api/v1/predict/batch":
                items = body if isinstance(body, list) else [body]
                model = get_model()
                outputs = []
                for item in items[:50]:
                    url = item.get("url", "") if isinstance(item, dict) else str(item)
                    validated_url = validate_url(url)
                    result = model.predict(validated_url)
                    result["url"] = validated_url
                    record_analysis(
                        url=validated_url,
                        prediction=result["prediction"],
                        risk_score=result["risk_score"],
                        risk_level=result["risk_level"],
                        model=result.get("model_name", ""),
                        analysis_id=result.get("analysis_id", ""),
                    )
                    outputs.append(result)
                _json_response(self, 200, {"results": outputs})

            else:
                _json_response(self, 404, {"detail": "Not found"})

        except ValueError as e:
            _json_response(self, 400, {"detail": str(e)})
        except ModelNotReadyError as e:
            _json_response(self, 503, {"detail": str(e)})
        except Exception as e:
            _json_response(self, 500, {"detail": str(e)})

    def do_DELETE(self):
        try:
            path = self.path.strip("/")
            parts = path.split("/")

            if len(parts) >= 3 and parts[-1]:
                analysis_id = parts[-1]
                if delete_analysis(analysis_id):
                    _json_response(self, 200, {"deleted": analysis_id})
                else:
                    _json_response(self, 404, {"detail": "Analysis not found."})
            elif path == "api/v1/history":
                cleared = clear_history()
                _json_response(self, 200, {"cleared": cleared})
            else:
                _json_response(self, 404, {"detail": "Not found"})

        except Exception as e:
            _json_response(self, 500, {"detail": str(e)})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        pass
