"""
============================================================================
 train.py — complete machine-learning pipeline
============================================================================
 PhishGuard AI: Intelligent Phishing Website Detection

 Run with:
     python -m ml.train

 Pipeline stages covered by this script:

     Dataset  ->  Cleaning  ->  Feature Engineering  ->  Train/Test Split
        ->  Model Training (LR/DT/RF/XGB)  ->  Evaluation  ->  Best Model
        ->  Save model + metadata

 Design notes
 ------------
 * A FIXED random_state (42) makes the experiment fully reproducible — the
   same train/test split (stratified 80/20) and the same models every run.
 * Models are compared on precision, recall, F1 and ROC-AUC.
 * The "best" model is chosen with a composite score = F1 + ROC-AUC
   (not plain accuracy, which is misleading on this kind of data).
 * The chosen model is serialized with joblib, and every metric that the
   frontend dashboards display is written to ``model_results.json``.
============================================================================
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import confusion_matrix
from xgboost import XGBClassifier

from ml import evaluate
from ml.feature_extractor import FEATURE_COLUMNS
from ml.preprocessing import build_feature_dataset

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = PROJECT_ROOT / "models"
MODEL_PATH = MODEL_DIR / "phishguard_model.joblib"
META_PATH = MODEL_DIR / "model_meta.json"

RANDOM_STATE = 42
TEST_SIZE = 0.20

#: Display thresholds for the risk meter (see risk scoring in model.py).
RISK_LEVELS = [
    (0.0, "LOW", "Low risk — likely safe, but always stay alert."),
    (0.3, "MEDIUM", "Medium risk — some phishing signals detected."),
    (0.6, "HIGH", "High risk — strong phishing characteristics."),
    (0.8, "CRITICAL", "Critical risk — treat as unsafe until proven otherwise."),
]


def build_models():
    """
    Return the four candidate classifiers as (name, estimator).

    Notes for the viva:
      - Logistic Regression is linear: it needs *scaled* features, so we wrap
        it in a StandardScaler pipeline.
      - Decision Tree and Random Forest are non-linear and scale-agnostic.
      - XGBoost is a boosted-tree ensemble and generally the strongest of the
        four, though with marginal gains over Random Forest on tabular data.
    """
    models = {
        "Logistic Regression": make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=2000, C=1.0, random_state=RANDOM_STATE),
        ),
        "Decision Tree": DecisionTreeClassifier(
            max_depth=22,
            min_samples_split=50,
            min_samples_leaf=25,
            random_state=RANDOM_STATE,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=250,
            max_depth=24,
            min_samples_split=20,
            max_features="sqrt",
            n_jobs=-1,
            random_state=RANDOM_STATE,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=300,
            learning_rate=0.1,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            tree_method="hist",
            n_jobs=-1,
            random_state=RANDOM_STATE,
            eval_metric="logloss",
        ),
    }
    return models


def _composite_score(metrics: dict) -> float:
    """Selection score = F1 + ROC-AUC. Better than accuracy alone."""
    return metrics["f1"] + metrics["roc_auc"]


def _class_statistics(features: pd.DataFrame) -> dict:
    """
    Compute per-feature means/std for each class.

    These statistics feed the *explainability* feature: after a prediction we
    compare the analyzed URL against typical legitimate/typical phishing URLs
    to say *why* the model leaned one way. Nothing is invented — the
    statistics come straight from the real dataset.
    """
    legit = features[features["label"] == 0]
    phish = features[features["label"] == 1]
    numeric_cols = FEATURE_COLUMNS
    return {
        "legit_means": {c: round(float(v), 6) for c, v in legit[numeric_cols].mean().items()},
        "phish_means": {c: round(float(v), 6) for c, v in phish[numeric_cols].mean().items()},
        "stds": {c: round(float(v), 6) for c, v in features[numeric_cols].std().items()},
        "legit_count": int(len(legit)),
        "phish_count": int(len(phish)),
    }


def run_pipeline(force_preprocess: bool = False) -> dict:
    """Execute the whole pipeline and return the final results summary."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    evaluate.EVALUATION_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # 1. Dataset loading + feature engineering (identical for inference)
    # ------------------------------------------------------------------
    features, dataset_info = build_feature_dataset(force=force_preprocess)
    X = features[FEATURE_COLUMNS]
    y = features["label"]

    # ------------------------------------------------------------------
    # 2. Train / test split (80 / 20, stratified, reproducible)
    # ------------------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    # ------------------------------------------------------------------
    # 3. Train + evaluate every candidate model
    # ------------------------------------------------------------------
    results = {"dataset": dataset_info, "models": {}}
    roc_data = {}
    metrics_summary = {}
    fitted = {}

    for name, model in build_models().items():
        print(f"[*] Training {name} ...", flush=True)
        model.fit(X_train, y_train)

        y_pred, y_proba = evaluate.collect_true_preds(model, X_test, y_test)
        m = evaluate.compute_metrics(y_test, y_pred, y_proba)
        fitted[name] = model
        metrics_summary[name] = m
        roc_data[name] = evaluate.summarize_roc(y_test, y_proba)

        results["models"][name] = {
            "metrics": m,
            "roc": roc_data[name],
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        }
        print(f"    -> acc={m['accuracy']:.4f} prec={m['precision']:.4f} "
              f"recall={m['recall']:.4f} f1={m['f1']:.4f} auc={m['roc_auc']:.4f}", flush=True)

    # ------------------------------------------------------------------
    # 4. Best-model selection (F1 + ROC-AUC) then persist artifacts
    # ------------------------------------------------------------------
    best_name = max(results["models"], key=lambda n: _composite_score(results["models"][n]["metrics"]))
    print(f"\n[*] Best model: {best_name} "
          f"(score={_composite_score(results['models'][best_name]['metrics']):.4f})")

    best_model = fitted[best_name]

    y_pred_best, _ = evaluate.collect_true_preds(best_model, X_test, y_test)

    # ---- Charts --------------------------------------------------------
    evaluate.plot_model_comparison(metrics_summary, evaluate.EVALUATION_DIR / "model_comparison.png")
    evaluate.plot_roc_curves(roc_data, evaluate.EVALUATION_DIR / "roc_curves.png", best_name)
    evaluate.plot_confusion_matrix(
        y_test, y_pred_best,
        f"Confusion matrix — {best_name} (test set)",
        evaluate.EVALUATION_DIR / "confusion_matrix.png",
    )

    # Feature importances only make sense for tree-based models.
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
    else:
        importances = np.ones(len(FEATURE_COLUMNS)) / len(FEATURE_COLUMNS)
    importance_list = [
        {"name": c, "importance": round(float(v), 6)}
        for c, v in zip(FEATURE_COLUMNS, importances)
    ]
    evaluate.plot_feature_importance(importance_list, evaluate.EVALUATION_DIR / "feature_importance.png")

    class_stats = _class_statistics(features)
    y_pred_best, y_proba_best = evaluate.collect_true_preds(best_model, X_test, y_test)

    results.update({
        "best_model": best_name,
        "best_metrics": results["models"][best_name]["metrics"],
        "feature_importance": importance_list,
        "class_stats": class_stats,
        "test_size": int(len(X_test)),
        "train_size": int(len(X_train)),
        "risk_levels": [
            {"max": hi, "label": lab, "description": desc} for hi, lab, desc in RISK_LEVELS
        ],
    })

    # ------------------------------------------------------------------
    # 5. Save model + metadata used by the live API
    # ------------------------------------------------------------------
    evaluate.save_results(results)
    joblib.dump(best_model, MODEL_PATH, compress=3)

    meta = {
        "model_name": best_name,
        "model_file": MODEL_PATH.name,
        "feature_columns": list(FEATURE_COLUMNS),
        "target_names": {0: "legitimate", 1: "phishing"},
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "class_stats": class_stats,
        "feature_importance": importance_list,
        "risk_levels": results["risk_levels"],
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    META_PATH.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[*] Model saved        -> {MODEL_PATH}")
    print(f"[*] Metadata saved     -> {META_PATH}")
    print(f"[*] Results saved      -> {evaluate.RESULTS_JSON}")
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train PhishGuard AI models")
    parser.add_argument("--force", action="store_true", help="Force re-extraction of features")
    args = parser.parse_args()

    run_pipeline(force_preprocess=args.force)