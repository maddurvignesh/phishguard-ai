# 🛡️ PhishGuard AI — Intelligent Phishing Website Detection

> **Detect phishing before it detects you.**

PhishGuard AI is a complete, production-style Machine-Learning project that
analyzes a **website URL** and estimates how likely it is to be phishing.
Every prediction comes from a **real trained model** — nothing is hardcoded,
nothing is faked, and no random numbers are used for accuracy.

The system:

1. extracts **hand-crafted URL features** (length, dots, hyphens, HTTPS, IP
   addresses, suspicious words like `login` / `verify` / `secure`, URL
   shorteners, and more),
2. scores those features with a **Random Forest** classifier trained on
   **~667,000 real URLs**,
3. returns a **prediction**, a **risk score (0–100%)**, a **risk level**
   (LOW / MEDIUM / HIGH / CRITICAL), a **confidence score**, an 8-card
   **URL Security Analysis**, and a data-driven **explanation** of why the URL
   was flagged.

---

## 1. Project Overview

| | |
|---|---|
| **Name** | PhishGuard AI |
| **Problem** | Phishing websites trick users into revealing credentials & personal data |
| **Solution** | Supervised ML binary classifier on URL-derived features |
| **Best model** | Random Forest (F1 ≈ 0.83, ROC-AUC ≈ 0.976 on the test set) |
| **Frontend** | React + TypeScript + Tailwind CSS + Recharts |
| **Backend** | Python + FastAPI |
| **ML stack** | scikit-learn, XGBoost, pandas, numpy, joblib, matplotlib |
| **Database** | SQLite (local analysis history) |

---

## 2. Problem Statement

More than **90% of security incidents** begin with phishing. Attackers send a
link that *looks* like a real service (a bank, PayPal, a mail provider) and
host it on a throwaway domain. Users cannot reliably distinguish these URLs
by eye. We need an automatic, explainable system that flags suspicious URLs
**before** the user submits credentials.

## 3. Objectives

- Build a genuine supervised ML pipeline from public data to a live web app.
- Engineer transparent URL features that work identically in training and prediction.
- Compare ≥ 4 classifiers and select the best by **F1 + ROC-AUC**, not raw accuracy.
- Expose the model through a clean REST API.
- Present a professional, responsive, "security SaaS" style web UI.
- Provide complete academic documentation (report, viva, presentation).

## 4. How Phishing Works (30-second version)

1. A victim receives an email/SMS with a link.
2. The link points to a domain that *imitates* a trusted brand
   (`paypal.com-usa.security.verify…`, or a shortened link).
3. The fake page asks for a password / OTP / card number.
4. The attacker steals and abuses that information.

Phishing URLs therefore have measurable fingerprints: excess subdomains,
IP-address hosts, deceptive keywords, `@` symbols, URL shorteners, missing
HTTPS, random character blobs, etc. Those fingerprints are exactly what we
teach the model to detect.

## 5. Proposed Solution

```
Dataset ─► Cleaning ─► EDA ─► Feature Extraction ─► Feature Engineering
   ─► Train/Test Split (80/20) ─► Model Training (LR, DT, RF, XGB)
   ─► Evaluation ─► Best Model (Random Forest) ─► Save (joblib)
   ─► FastAPI backend ─► React frontend
```

Every prediction re-uses the **same** `extract_features()` function that built
the training matrix, so training and live inference can never drift apart.

## 6. System Architecture

```
┌──────────────────┐        ┌───────────────────────┐        ┌──────────────┐
│  React frontend   │  HTTP  │   FastAPI backend     │  load  │ trained model │
│  (Vite, Tailwind) │ ─────► │  /predict /model-info │ ─────► │  (joblib)     │
│  Recharts charts  │        │  /statistics /history │        └──────────────┘
└──────────────────┘        │  + SQLite history     │
                            └───────────────────────┘
```

The model is loaded **once** at backend startup and shared across requests
(never retrained per request).

## 7. Dataset

Two **public, citable** sources are used. Nothing is fabricated.

| Source | What | Purpose |
|---|---|---|
| **Phishing Site URLs** (Kaggle; HF mirror `alexkstern/phishing_urls`) | ~507k URLs with `label` (0 = legitimate, 1 = phishing) | Main corpus |
| **Tranco top-sites list** (`tranco-list.eu`) | the ~80k most-visited legitimate domains | Fixes the "bare homepage" class imbalance (the corpus contains almost no path-less legitimate homepages) |

The final merged dataset has **667,127 unique URLs** (~552k legitimate,
~114k phishing).

### How to obtain the data (already done, but reproducible)

```bash
python -m ml.fetch_dataset      # downloads missing files into data/raw/
```

Files placed / generated in `data/raw/`:

- `train.csv`, `test.csv` — main corpus (URL + label)
- `legit_homepages.csv` — Tranco legitimate homepages (url + label)

> If you prefer, you can download `phishing_site_urls.csv` from
> <https://www.kaggle.com/datasets/arifmia/phishing-site-urls> and drop it into
> `data/raw/`. `ml/preprocessing.py` auto-detects `url`/`label`, `url`/`status`
> (`good`/`bad`) or `text`/`label` columns.

## 8. Feature Engineering

`ml/feature_extractor.py` is the **single source of truth**. It converts one
URL into **32 numeric features**, e.g.:

`url_length, num_dots, num_hyphens, num_slashes, num_question_marks,
num_equals, num_at, num_special_chars, num_digits, num_letters, num_subdomains,
has_https, has_ip_address, has_at_symbol, has_hex_string,
has_suspicious_keywords, suspicious_keywords_count, digit_ratio,
special_char_ratio, is_shortened, tld_is_suspicious, path_length,
query_length, num_params, …`

Two correctness-critical design decisions:

- **Scheme normalization** — the public corpus stores URLs without `https://`;
  structural features are therefore computed on the scheme-stripped URL both
  in training **and** at prediction time (avoids train/serve skew).
- **No crawling** — the URL is treated purely as text. PhishGuard never
  visits, downloads from, or executes anything from the submitted URL.

## 9. Machine-Learning Algorithms

| Model | Why it is here |
|---|---|
| **Logistic Regression** | a simple, interpretable linear baseline (needs scaled features → wrapped in `StandardScaler`) |
| **Decision Tree** | interpretable non-linear baseline |
| **Random Forest** | ensemble of trees; strong on tabular data, gives feature importances |
| **XGBoost** | boosted-tree ensemble; usually the strongest of the four |

All models are trained with `random_state = 42` for reproducibility.

## 10. Training Process

```bash
python -m ml.train          # pipeline below
python -m ml.train --force  # force re-extraction of features
```

Steps inside `ml/train.py`:

1. load / clean / de-duplicate the dataset (`ml/preprocessing.py`),
2. extract features with `ml/feature_extractor.py`,
3. stratified **80/20** train/test split (seed 42),
4. fit LR, DT, RF, XGBoost,
5. evaluate on the **held-out test set**,
6. choose the best model by **score = F1 + ROC-AUC**,
7. write `ml/evaluation/*.png` charts + `model_results.json`,
8. save the winner to `models/phishguard_model.joblib` + `model_meta.json`.

## 11. Evaluation Metrics

Accuracy, **Precision**, **Recall**, **F1-score**, **ROC-AUC**, plus:
confusion matrix, ROC curves, feature importance and a model comparison chart.

Actual results (Random Forest, held-out test set, **real numbers**):

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 90.3% | 87.3% | 50.7% | 0.641 | 0.894 |
| Decision Tree | 93.6% | 87.4% | 73.4% | 0.798 | 0.962 |
| **Random Forest** | **94.6%** | **92.1%** | 75.2% | **0.828** | **0.976** |
| XGBoost | 94.4% | 89.9% | 75.7% | 0.822 | 0.974 |

(These values update automatically when you re-run `python -m ml.train`.)

## 12. Screenshots

Add screenshots here for your submission:

`docs/screenshots/home.png`, `docs/screenshots/result.png`,
`docs/screenshots/insights.png`, `docs/screenshots/dashboard.png`

## 13. Installation

Requirements: **Python 3.10+**, **Node.js 18+**, **npm**.

```bash
# backend + ML
cd phishguard-ai
python -m venv .venv
.venv\Scripts\activate          # Windows   (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt

# frontend
cd frontend
npm install
```

## 14. How to Run

In three terminals (or use the npm scripts below):

```bash
# 1) (optional) fetch the public dataset   → data/raw/
python -m ml.fetch_dataset

# 2) train + evaluate + save the model     → models/ + ml/evaluation/
python -m ml.train

# 3) start the API                         → http://127.0.0.1:8000/docs
python -m uvicorn backend.app.main:app --port 8000

# 4) start the web app                     → http://127.0.0.1:5273
cd frontend
npm run dev
```

You can try the model from the command line without the web UI:

```bash
python -m ml.predict "https://example.com"
```

## 15. API Documentation

Interactive docs: <http://127.0.0.1:8000/docs>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/predict` | Analyze one URL → `{prediction, risk_score, risk_level, confidence, features, …}` |
| `POST` | `/api/v1/predict/batch` | Analyze up to 50 URLs |
| `GET` | `/api/v1/health` | Liveness + model status |
| `GET` | `/api/v1/model-info` | Training summary, per-model metrics, ROC, confusion matrix, feature importance |
| `GET` | `/api/v1/statistics` | Dashboard totals from SQLite history |
| `GET` | `/api/v1/history` | Recent analyses (newest first) |
| `DELETE` | `/api/v1/history` | Clear local history |

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

```json
{
  "prediction": "legitimate",
  "risk_score": 0.001,
  "risk_level": "LOW",
  "confidence": 0.999,
  "features": { ... },
  "security_analysis": [ ... ],
  "explanation": [ ... ]
}
```

## 16. Project Structure

```
phishguard-ai/
├── frontend/            React + TypeScript + Tailwind + Recharts UI
│   └── src/pages/       Home (detector), Insights, Dashboard
├── backend/             FastAPI app
│   └── app/             main.py, routes/, database.py (SQLite), config.py
├── ml/                  ★ the machine-learning pipeline
│   ├── fetch_dataset.py   download public datasets
│   ├── preprocessing.py   clean → features (data/processed)
│   ├── feature_extractor.py  ★ 32 URL features, used for training AND inference
│   ├── train.py           train LR/DT/RF/XGB, evaluate, save best model
│   ├── evaluate.py        metrics + charts + model_results.json
│   ├── model.py           load-once inference service + explanations
│   └── predict.py         CLI inference
├── data/
│   ├── raw/              public datasets (see §7)
│   └── processed/        features.csv + dataset_summary.json
├── models/               phishguard_model.joblib + model_meta.json
├── notebooks/            optional EDA notebooks
├── tests/                pytest suite (58 tests)
├── docs/                 project_report.md, viva_questions.md, presentation_outline.md
├── requirements.txt
└── README.md
```

## 17. Testing

```bash
python -m pytest tests -q
```

Coverage: URL feature extraction, label coercing, invalid-URL handling, model
loading errors, `/predict` response format, `/model-info` metrics, statistics
and history, and the guarantee that training and inference share the same
feature columns.

## 18. Limitations

- Uses **only URL structure** — page content, TLS certificates and reputation
  are not inspected (by design: defensive, never crawls sites).
- The corpus stores URLs **without schemes**; HTTPS is therefore a
  rule-based indicator on the UI, not a strong model feature.
- A **short URL** or a **high number of hyphens** may occasionally cause
  false positives on unusual-but-legitimate sites.
- The model estimates **probability, never certainty**.

## 19. Future Improvements

- Content-based features (HTML title/brand match) via safe, opt-in crawling.
- Live verification against PhishTank / Google Safe Browsing APIs.
- Browser extension so users are warned while clicking links.
- Attention-aware deep models (only after the tabular baseline is understood).
- Model calibration (Platt scaling) for sharper probabilities.

## 20. Team Members

| Name | Role | Contributions |
|---|---|---|
| **Maddur Vignesh** | Author & ML engineer | dataset pipeline, feature engineering, model training & evaluation, backend API, frontend UI, documentation |

---

⚠️ **Disclaimer.** PhishGuard AI is an educational defensive-security project.
Predictions are probabilistic estimates from a trained model. Always verify web
destinations before entering credentials. The application never visits,
crawls or executes any submitted URL.