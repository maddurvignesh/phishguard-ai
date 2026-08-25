"""
model_health.py — GET /api/v1/model-health
"""

from __future__ import annotations

import sys
from pathlib import Path

from http.server import BaseHTTPRequestHandler
import json

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from api._lib.model import get_model, load_results


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            manager = get_model()
            results = load_results()
            meta = manager.meta

            response = {
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
