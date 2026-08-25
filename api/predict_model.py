"""
predict_model.py — POST /api/v1/predict/model/{model_name}
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from http.server import BaseHTTPRequestHandler
import json

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from api._lib.model import get_model, ModelNotReadyError
from api._lib.database import record_analysis

_MAX_URL_LENGTH = 2048
_INVALID_CHARS = re.compile(r"[\s]")
_ALLOWED = re.compile(r"^[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%\x00-\x7F]*$")


def validate_url(url: str) -> str:
    if not url or not url.strip():
        raise ValueError("Please enter a website URL.")
    url = url.strip()
    if len(url) < 4:
        raise ValueError("That URL is too short to be a valid website address.")
    if len(url) > _MAX_URL_LENGTH:
        raise ValueError(f"URL is too long (maximum {_MAX_URL_LENGTH} characters).")
    if _INVALID_CHARS.search(url):
        raise ValueError("URL contains whitespace.")
    if not _ALLOWED.match(url):
        raise ValueError("URL contains unsupported characters.")
    return url


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            path = self.path
            model_name = path.split("/predict/model/")[-1].split("?")[0]
            model_name = model_name.replace("%20", " ")

            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
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

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except ValueError as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": str(e)}).encode())

        except ModelNotReadyError as e:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": str(e)}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
