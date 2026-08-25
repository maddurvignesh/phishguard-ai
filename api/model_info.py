"""
model_info.py — GET /api/v1/model-info
"""

from __future__ import annotations

import sys
from pathlib import Path

from http.server import BaseHTTPRequestHandler
import json

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from _lib.model import load_results


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            results = load_results()
            if not results:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "No training results found."}).encode())
                return

            response = {
                "dataset": results.get("dataset"),
                "best_model": results.get("best_model"),
                "best_metrics": results.get("best_metrics"),
                "models": results.get("models"),
                "feature_importance": results.get("feature_importance"),
                "test_size": results.get("test_size"),
                "train_size": results.get("train_size"),
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
