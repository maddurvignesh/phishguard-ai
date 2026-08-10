"""
============================================================================
 preprocessing.py — build the clean, feature-engineered dataset
============================================================================
 PhishGuard AI
----------------------------------------------------------------------------
 Pipeline stage #2 (after dataset acquisition):

     raw URLs (data/raw)  -->  clean + de-duplicated  -->  features (data/processed)

 Responsibilities
 ----------------
 1. Load the raw CSV(s) that live in ``data/raw/``.
 2. Standardize column names (the public dataset uses ``text`` / ``label``,
    but we accept ``url`` / ``status`` too).
 3. Drop missing values, duplicates and unusable rows.
 4. Apply ``feature_extractor.extract_features`` to every URL.
 5. Save the resulting feature matrix as ``data/processed/features.csv``
    and a machine-readable summary of the dataset statistics.
============================================================================
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from ml.feature_extractor import FEATURE_COLUMNS, extract_features

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

RAW_PATTERNS = ("*.csv",)


class UnknownLabelError(ValueError):
    """Raised when a raw dataset uses a label representation we cannot map."""


def locate_raw_files(data_dir: Path = RAW_DATA_DIR) -> list[Path]:
    """Return every CSV file present in the raw data directory."""
    files: list[Path] = []
    for pattern in RAW_PATTERNS:
        files.extend(sorted(data_dir.glob(pattern)))
    if not files:
        raise FileNotFoundError(
            "No dataset found in data/raw/. Please download a phishing URL "
            "dataset there first — see README.md for exact instructions."
        )
    return files


def _canonical_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Rename the dataset columns to the canonical (url, label) form.

    Accepted raw inputs:
        'text' / 'label'   (alexkstern record, integer labels)
        'url'  / 'label'
        'url'  / 'status'  (raw Kaggle rows use good/bad strings)
    """
    mapping = {"text": "url", "Label": "url", "url": "url"}
    rename = {}
    for col in df.columns:
        low = str(col).strip().lower()
        if low in ("text", "url", "url_input", "weburl", "link", "phish_id_url"):
            rename[col] = "url"
        elif low in ("label", "class", "result", "status", "type", "target", "is_phishing"):
            rename[col] = "label"
    df = df.rename(columns=rename)

    missing = [c for c in ("url", "label") if c not in df.columns]
    if missing:
        raise ValueError(
            f"Dataset columns {missing} not found. Found: {list(df.columns)}. "
            "Expected a CSV with a URL column and a label column. See README.md."
        )
    return df


def coerce_labels(series: pd.Series) -> pd.Series:
    """
    Convert every supported label representation into 0 (legitimate) / 1 (phishing).

    Known variants:
        int 0/1         -> 0/1
        'good'/'bad'    -> 0/1        (raw Kaggle arifmia dataset)
        'legitimate'/'phishing' -> 0/1
        'benign'/'malicious'     -> 0/1
    """
    out = []
    for v in series:
        if isinstance(v, (int, float)) and v in (0, 1):
            out.append(v)
        elif isinstance(v, (int, float)) and v in (-1, 1):
            out.append(1 if v == 1 else 0)
        else:
            s = str(v).strip().lower()
            if s in ("0", "good", "legitimate", "benign", "safe", "normal", "false", "no"):
                out.append(0)
            elif s in ("1", "bad", "phishing", "malicious", "unsafe", "true", "yes"):
                out.append(1)
            else:
                raise UnknownLabelError(f"Cannot map label value: {v!r}")
    return pd.Series(out, index=series.index, dtype=int)


def load_dataset(data_dir: Path = RAW_DATA_DIR) -> pd.DataFrame:
    """Load, clean and label-standardize the raw dataset(s)."""
    files = locate_raw_files(data_dir)
    frames = []
    for f in files:
        df = pd.read_csv(f, dtype=str, keep_default_na=True, on_bad_lines="skip")
        frames.append(_canonical_columns(df))
    df = pd.concat(frames, ignore_index=True)

    return df


def build_feature_dataset(force: bool = False) -> tuple[pd.DataFrame, dict]:
    """
    Build ``data/processed/features.csv`` from the raw dataset.

    Returns (feature_frame, summary_dict) where ``summary_dict`` describes the
    dataset before/after cleaning and is additionally written to disk as
    ``data/processed/dataset_summary.json``.
    """
    processed_csv = PROCESSED_DIR / "features.csv"
    summary_json = PROCESSED_DIR / "dataset_summary.json"

    if processed_csv.exists() and summary_json.exists() and not force:
        df = pd.read_csv(processed_csv)
        with summary_json.open("r", encoding="utf-8") as fh:
            return df, json.load(fh)

    # ---- 1. Raw load -----------------------------------------------------
    raw = load_dataset()
    raw_before = len(raw)

    # ---- 2. Clean --------------------------------------------------------
    raw["url"] = raw["url"].astype(str).str.strip()
    raw = raw[raw["url"] != ""]
    # remove nulls / extremely long inputs
    raw = raw[raw["url"].str.len().between(1, 4096)]

    # ---- 3. De-duplicate ------------------------------------------------
    raw = raw.drop_duplicates(subset=["url"]).reset_index(drop=True)
    dup_dropped = raw_before - len(raw)

    # ---- 4. Standardize labels -------------------------------------------
    raw["label"] = coerce_labels(raw["label"])

    # ---- 5. Feature extraction -------------------------------------------
    # CRITICAL: URL and label are captured TOGETHER inside the loop.
    # If a row is skipped we must not shift the label pairing, otherwise the
    # features and labels drift apart (a classic, silent data bug).
    rows, labels, skipped = [], [], 0
    for url, label in zip(raw["url"].tolist(), raw["label"].tolist()):
        try:
            rows.append(extract_features(url))
            labels.append(label)
        except ValueError:
            skipped += 1

    features = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
    features["label"] = labels
    features = features.dropna().reset_index(drop=True)

    # ---- 6. Persist --------------------------------------------------------
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    features.to_csv(processed_csv, index=False)

    summary = {
        "raw_rows_total": int(raw_before),
        "rows_after_clean": int(len(features)),
        "duplicates_dropped": int(dup_dropped),
        "unparseable_dropped": int(skipped),
        "legitimate_count": int((features["label"] == 0).sum()),
        "phishing_count": int((features["label"] == 1).sum()),
        "num_features": int(len(FEATURE_COLUMNS)),
        "feature_columns": list(FEATURE_COLUMNS),
    }
    with summary_json.open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, ensure_ascii=False)

    return features, summary


if __name__ == "__main__":
    frames, info = build_feature_dataset(force=True)
    print(f"Dataset ready: {info}")
    print(frames.head())