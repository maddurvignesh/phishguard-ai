"""
============================================================================
 predict.py — command-line inference (demo / debugging)
============================================================================
 PhishGuard AI
----------------------------------------------------------------------------
 Usage:
     python -m ml.predict "https://example.com"
     python -m ml.predict "https://paypal.com-usa.security.login.verify.webscr/"

 Proves that training and prediction share one identical feature extractor
 (see ml/feature_extractor.py) and that every prediction really comes from
 the trained model saved by ``python -m ml.train``.
============================================================================
"""

from __future__ import annotations

import argparse
import json

from ml.model import get_model


def pretty_print(result: dict) -> None:
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    print("\n--- Summary ---")
    print(f"URL          : {result['url']}")
    print(f"Prediction   : {result['prediction'].upper()}")
    print(f"Risk score   : {result['risk_score_percent']:.1f}%  ({result['risk_level']})")
    print(f"Confidence   : {result['confidence_percent']:.1f}%")


def main() -> int:
    parser = argparse.ArgumentParser(description="Predict legitimacy of a URL")
    parser.add_argument("url", help="Website URL to analyze")
    parser.add_argument("--json", action="store_true", help="Print raw JSON output")
    args = parser.parse_args()

    model = get_model()
    result = model.predict(args.url)
    result["url"] = args.url

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        pretty_print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())