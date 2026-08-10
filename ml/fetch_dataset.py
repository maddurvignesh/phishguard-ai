"""
fetch_dataset.py — download the real public datasets used by PhishGuard AI.

Nothing here is fabricated; every record comes from a public, citable source.

1. Primary corpus (phishing + legitimate URLS with labels)
   HuggingFace record `alexkstern/phishing_urls` — a mirror of the widely-used
   Kaggle "Phishing Site URLs" dataset (~507k rows): text=True URL,
   label=0 legitimate / 1 phishing.
   https://huggingface.co/datasets/alexkstern/phishing_urls

2. Legitimate homepage augmentation
   Tranco top-sites list (https://tranco-list.eu) — the standard authoritative
   ranking of the most-visited domains. The primary corpus contains almost no
   bare legitimate homepages, so the top-N popular domains are added as
   legitimate samples so the model understands normal homepages are not
   phishing.

Usage:
    python -m ml.fetch_dataset              # download whatever is missing
    python -m ml.fetch_dataset --force      # re-download everything
"""

from __future__ import annotations

import argparse
import csv
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"

HF_CORPUS_BASE = "https://huggingface.co/datasets/alexkstern/phishing_urls/resolve/main"
CORPUS_FILES = ["train.csv", "test.csv"]

TRANCO_ZIP_URL = "https://tranco-list.eu/top-1m.csv.zip"
TRANCO_TOP_N = 80000

_force = False


def _download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] {dest.name} already present")
        return
    print(f"  [fetch] {url}")
    subprocess.run(["curl", "-sL", "--retry", "3", "-o", str(dest), url], check=True, timeout=600)
    if dest.stat().st_size == 0:
        raise RuntimeError(f"Downloaded file is empty: {dest}")


def ensure_corpus() -> None:
    """Make sure train.csv / test.csv exist in data/raw."""
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name in CORPUS_FILES:
        _download(f"{HF_CORPUS_BASE}/{name}", RAW_DATA_DIR / name)


def build_legitimate_homepages() -> Path:
    """Build data/raw/legit_homepages.csv from the Tranco top-sites list."""
    dest = RAW_DATA_DIR / "legit_homepages.csv"
    if dest.exists() and not _force:
        print("  [skip] legit_homepages.csv already present (use --force to rebuild)")
        return dest

    zip_path = RAW_DATA_DIR / "top-1m.csv.zip"
    _download(TRANCO_ZIP_URL, zip_path)

    print(f"  [build] top-{TRANCO_TOP_N} legitimate homepages ...")
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extract("top-1m.csv", tmp)
        with open(Path(tmp) / "top-1m.csv", newline="", encoding="utf-8", errors="ignore") as fh:
            reader = csv.reader(fh)
            for i, row in enumerate(reader):
                if i >= TRANCO_TOP_N:
                    break
                if len(row) < 2:
                    continue
                domain = row[1].strip().lower()
                if not domain:
                    continue
                # Bare form + typical user form (www + https), both legitimate.
                rows.append((domain, 0))
                rows.append((f"https://www.{domain}", 0))

    df = pd.DataFrame(rows, columns=["url", "label"])
    df = df.drop_duplicates(subset=["url"]).reset_index(drop=True)
    df.to_csv(dest, index=False)
    print(f"  [done] {len(df)} legitimate homepage rows -> {dest}")
    return dest


def main() -> None:
    global _force
    parser = argparse.ArgumentParser(description="Fetch PhishGuard AI datasets")
    parser.add_argument("--force", action="store_true", help="Re-download everything")
    args = parser.parse_args()
    _force = args.force

    ensure_corpus()
    build_legitimate_homepages()
    print("All datasets are in place under data/raw/")


if __name__ == "__main__":
    main()