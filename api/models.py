"""
models.py — GET /api/v1/models
"""

from __future__ import annotations

import sys
from pathlib import Path

from http.server import BaseHTTPRequestHandler
import json

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from _lib.model import get_model, load_results


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            results = load_results()
            manager = get_model()
            available = manager.models_available

            metrics = results.get("models", {}) if results else {}
            response = {
                "best_model": results.get("best_model") if results else manager.model_name,
                "models": [
                    {
                        "name": name,
                        "available": name in available,
                        "metrics": (metrics.get(name) or {}).get("metrics"),
                    }
                    for name in available
                ],
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
