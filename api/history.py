"""
history.py — GET/DELETE /api/v1/history
"""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from http.server import BaseHTTPRequestHandler
import json

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from api._lib.database import get_history, clear_history, delete_analysis


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            limit = int(params.get("limit", ["20"])[0])
            q = params.get("q", [""])[0]
            prediction = params.get("prediction", [""])[0]

            results = get_history(
                limit=min(max(limit, 1), 100),
                q=q[:200],
                prediction=prediction,
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"results": results}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": str(e)}).encode())

    def do_DELETE(self):
        try:
            parsed = urlparse(self.path)
            path_parts = parsed.path.strip("/").split("/")

            if len(path_parts) >= 3 and path_parts[-1]:
                analysis_id = path_parts[-1]
                if delete_analysis(analysis_id):
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps({"deleted": analysis_id}).encode())
                else:
                    self.send_response(404)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"detail": "Analysis not found."}).encode())
            else:
                cleared = clear_history()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"cleared": cleared}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
