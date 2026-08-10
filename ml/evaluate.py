"""
============================================================================
 evaluate.py — model evaluation, charts and artifact generation
============================================================================
 PhishGuard AI
----------------------------------------------------------------------------
 Every number that the web application later displays (accuracy, precision,
 recall, F1, ROC-AUC, confusion matrix, feature importance) is computed HERE
 from the real trained-model predictions on the held-out test set.

 Nothing on any dashboard is hardcoded.
============================================================================
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless backend — no display needed
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EVALUATION_DIR = PROJECT_ROOT / "ml" / "evaluation"
RESULTS_JSON = EVALUATION_DIR / "model_results.json"

sns.set_theme(style="darkgrid", rc={"axes.facecolor": "#0b1220", "figure.facecolor": "#0b1220"})

COLOR_LEGIT = "#10b981"
COLOR_PHISH = "#ef4444"
COLOR_ACCENT = "#22d3ee"
COLOR_GRID = "#1f2937"

MODEL_DISPLAY = {
    "Logistic Regression": "Logistic Regression (LR)",
    "Decision Tree": "Decision Tree (DT)",
    "Random Forest": "Random Forest (RF)",
    "XGBoost": "XGBoost (XGB)",
}


def compute_metrics(y_true, y_pred, y_proba) -> dict:
    """Return a dict of every headline metric for one model."""
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_proba)),
    }


def _base_style():
    fig, ax = plt.subplots(figsize=(9, 6), dpi=140)
    fig.patch.set_facecolor("#0b1220")
    ax.set_facecolor("#0b1220")
    return fig, ax


def plot_confusion_matrix(y_true, y_pred, title: str, path: Path) -> str:
    """Persist a confusion-matrix heatmap and return its filename."""
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = _base_style()
    labels = ["Legitimate", "Phishing"]
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues", cbar=False,
        xticklabels=labels, yticklabels=labels,
        linewidths=1, linecolor=COLOR_GRID,
        annot_kws={"size": 18, "color": "white"},
        ax=ax,
    )
    ax.set_title(title, color="white", fontsize=14, pad=14)
    ax.set_xlabel("Predicted", color="#9ca3af", fontsize=12)
    ax.set_ylabel("Actual", color="#9ca3af", fontsize=12)
    plt.setp(ax.get_xticklabels(), color="white")
    plt.setp(ax.get_yticklabels(), color="white")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path.name


def plot_roc_curves(roc_data: dict, path: Path, best_model: str) -> str:
    """Plot every model's ROC curve on one figure."""
    fig, ax = _base_style()
    for name, d in roc_data.items():
        label = f"{MODEL_DISPLAY.get(name, name)} (AUC {d['auc']:.3f})"
        ax.plot(d["fpr"], d["tpr"], lw=2, label=label,
                color=COLOR_ACCENT if name == best_model else None,
                ls="-" if name == best_model else "--")
    ax.plot([0, 1], [0, 1], color="#374151", ls=":", lw=1.2, label="Random guess")
    ax.set_title("ROC Curves — all models vs best (solid)", color="white", fontsize=14)
    ax.set_xlabel("False Positive Rate", color="#9ca3af")
    ax.set_ylabel("True Positive Rate", color="#9ca3af")
    ax.tick_params(colors="#9ca3af")
    ax.grid(color=COLOR_GRID, alpha=0.5)
    ax.legend(facecolor="#0f172a", edgecolor="#1f2937", labelcolor="white", fontsize=10)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path.name


def plot_feature_importance(importance: list, path: Path) -> str:
    """Horizontal bar chart of the best model's feature importances."""
    items = sorted(importance, key=lambda x: x["importance"])[-15:]  # top-15
    names = [i["name"] for i in items]
    vals = [i["importance"] for i in items]

    fig, ax = _base_style()
    ax.barh(names, vals, color=COLOR_ACCENT, edgecolor="#155e75")
    for idx, v in enumerate(vals):
        ax.text(v + max(vals) * 0.01, idx, f"{v:.4f}", va="center",
                color="#22d3ee", fontsize=9)
    ax.set_title("Feature Importance — best model (Random Forest / Tree-based)",
                 color="white", fontsize=14)
    ax.tick_params(colors="#9ca3af", labelsize=9)
    ax.grid(color=COLOR_GRID, alpha=0.4, axis="x")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path.name


def plot_model_comparison(metrics_summary: dict, path: Path) -> str:
    """Grouped bar chart comparing accuracy / precision / recall / f1 / auc."""
    metric_keys = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    names = list(metrics_summary.keys())
    x = np.arange(len(names))
    width = 0.14
    palette = ["#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"]

    fig, ax = _base_style()
    for i, m in enumerate(metric_keys):
        ax.bar(x + i * width, [metrics_summary[n][m] for n in names], width,
               label=m.capitalize().replace("_", "-") if m != "roc_auc" else "ROC-AUC",
               color=palette[i], edgecolor=COLOR_GRID, linewidth=0.6)
    ax.set_xticks(x + width * 2)
    ax.set_xticklabels([MODEL_DISPLAY.get(n, n) for n in names],
                       rotation=12, ha="right", fontsize=9, color="#9ca3af")
    ax.set_ylim(0, 1.02)
    ax.set_yticks(np.arange(0, 1.05, 0.1))
    ax.set_yticklabels([f"{v:.0%}" for v in np.arange(0, 1.05, 0.1)], color="#9ca3af")
    ax.set_title("Model comparison on the held-out test set", color="white", fontsize=14)
    ax.grid(color=COLOR_GRID, alpha=0.4, axis="y")
    ax.legend(facecolor="#0f172a", edgecolor="#1f2937", labelcolor="white", ncol=3, fontsize=9)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path.name


def collect_true_preds(model, X_test, y_test):
    """Return (y_pred, y_proba) for one fitted model."""
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    return y_pred, y_proba


def save_results(results: dict) -> Path:
    """Persist the full evaluation summary as JSON for the dashboards."""
    EVALUATION_DIR.mkdir(parents=True, exist_ok=True)
    with RESULTS_JSON.open("w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, ensure_ascii=False, default=str)
    return RESULTS_JSON


def summarize_roc(y_true, y_proba, n_points: int = 200):
    """Compact ROC curve (threshold-sampled) for storage in JSON/API."""
    fpr, tpr, _ = roc_curve(y_true, y_proba)
    keep = np.linspace(0, len(fpr) - 1, n_points, dtype=int)
    return {
        "fpr": [round(float(v), 5) for v in fpr[keep]],
        "tpr": [round(float(v), 5) for v in tpr[keep]],
        "auc": float(roc_auc_score(y_true, y_proba)),
    }