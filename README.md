<div align="center">

# 🛡️ PhishGuard AI

### *Detect phishing before it detects you.*

**An intelligent, explainable Machine-Learning system that tells you whether a website URL is likely to be phishing — in milliseconds.**

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/Machine%20Learning-scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)
![XGBoost](https://img.shields.io/badge/Boosting-XGBoost-0A6EBD?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/UI-React%20%2B%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Style-Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/tests-58%20passed-22c55e?style=for-the-badge)
![Model](https://img.shields.io/badge/best%20model-Random%20Forest-10b981?style=for-the-badge)
![AUC](https://img.shields.io/badge/ROC--AUC-0.976-22d3ee?style=for-the-badge)

---

**Real model. Real metrics. Real product quality.** Every prediction comes from a trained **Random Forest** — nothing hardcoded, none of the accuracy numbers are random or invented.

</div>

---

## ✨ Highlights

| | |
|---|---|
| ⚙️ **Full ML pipeline** | Data → cleaning → features → 4 models → evaluation → deployment |
| 🧠 **32 engineered URL features** | words, dots, hyphens, HTTPS, IPs, shorteners, suspicious TLDs… |
| 🎯 **Fair model selection** | picked by **F1 + ROC-AUC**, not misleading accuracy |
| 🚀 **Loaded once, served fast** | model is loaded at API startup, never retrained per request |
| 🧾 **Explainable by design** | each verdict shows *why*, from real per-class statistics |
| 🧬 **URL Anatomy + Threat DNA** | visual URL breakdown + radar profile from real features |
| 🔬 **Model Playground + What-if** | compare all 4 models; simulate feature edits honestly |
| 🔒 **Defensive by default** | URLs are read as **text only** — the app never crawls or visits sites |
| 🖥️ **Professional UI** | dark cybersecurity aesthetic, glassmorphism, live charts |
| 📚 **Exam-ready docs** | report, 55 viva Q&As, presentation outline, demo script |

## 🚀 Quick Start (TL;DR)

```bash
pip install -r requirements.txt   # backend + ML
cd frontend && npm install         # UI

python -m ml.train                          # train + evaluate + save model
python -m uvicorn backend.app.main:app --port 8000   # API → /docs
cd frontend && npm run dev                  # UI  → http://127.0.0.1:5273
```

> It *already works out of the box* — the model, dataset and frontend are trained and configured.

---

## 📑 Table of Contents

- [1 · Project Overview](#1--project-overview)
- [2 · Problem Statement](#2--problem-statement)
- [3 · Objectives](#3--objectives)
- [4 · How Phishing Works](#4--how-phishing-works-30-second-version)
- [5 · Proposed Solution](#5--proposed-solution)
- [6 · System Architecture](#6--system-architecture)
- [7 · Dataset](#7--dataset)
- [8 · Feature Engineering](#8--feature-engineering)
- [9 · Machine-Learning Algorithms](#9--machine-learning-algorithms)
- [10 · Training Process](#10--training-process)
- [11 · Evaluation & Real Results](#11--evaluation--real-results)
- [12 · Screenshots](#12--screenshots)
- [13 · Installation](#13--installation)
- [14 · How to Run](#14--how-to-run)
- [15 · API Documentation](#15--api-documentation)
- [16 · Project Structure](#16--project-structure)
- [17 · Testing](#17--testing)
- [18 · Limitations](#18--limitations)
- [19 · Future Improvements](#19--future-improvements)
- [20 · Team Members](#20--team-members)

---

## 1 · Project Overview

| | |
|---|---|
| **Name** | PhishGuard AI |
| **Problem** | Phishing websites trick users into revealing credentials & personal data |
| **Solution** | Supervised ML binary classifier on URL-derived features |
| **Best model** | Random Forest — F1 **0.828**, ROC-AUC **0.976** on the held-out test set |
| **Data volume** | **667,127** real URLs (~552k legit · ~114k phishing) |
| **Frontend** | React + TypeScript + Tailwind CSS + Recharts |
| **Backend** | Python + FastAPI |
| **ML stack** | scikit-learn · XGBoost · pandas · NumPy · joblib · matplotlib |
| **Database** | SQLite (local analysis history) |
| **Tests** | 58 pytest cases |

## 2 · Problem Statement

More than **90% of security incidents** begin with phishing. An attacker sends a link that *looks* like a bank or mail provider and hosts it on a throwaway lookalike domain (`paypal.com-usa.security.verify…`). Users cannot reliably tell such URLs apart by eye.

We need an **automatic, explainable** system that flags suspicious URLs **before** the user submits credentials — and tells them *why*.

## 3 · Objectives

- ✅ Build a genuine supervised-ML pipeline from public data to a live web app.
- ✅ Engineer transparent URL features used **identically** in training and prediction.
- ✅ Compare ≥ 4 classifiers, select the best by **F1 + ROC-AUC** rather than accuracy.
- ✅ Expose the model through a clean, well-documented REST API.
- ✅ Deliver a professional, responsive, "security SaaS" web UI.
- ✅ Provide exam-ready documentation (report, viva, presentation).

## 4 · How Phishing Works (30-second version)

1. 📧 A victim receives an email / SMS with an enticing link.
2. 🔗 The link points to a site that *imitates* a trusted brand (or hides inside a shortener).
3. ⌨️ The fake page asks for a password / OTP / card number.
4. 💸 The attacker steals and abuses that information.

Phishing URLs therefore carry measurable fingerprints: excessive subdomains, IP-address hosts, deceptive words (`login`, `verify`, `secure`, `wallet`…), `@` symbols, shorteners, missing HTTPS, random character blobs. **Those fingerprints are exactly what the model learns to detect.**

## 5 · Proposed Solution

```
Dataset ─► Cleaning ─► EDA ─► Feature Extraction ─► Feature Engineering
   ─► Train/Test Split (80/20) ─► Model Training (LR · DT · RF · XGB)
   ─► Evaluation ─► Best Model (Random Forest) ─► Save (joblib)
   ─► FastAPI backend ─► React frontend
```

Every prediction re-uses the **same** `extract_features()` function that built the training matrix — training and live inference can **never** drift apart.

## 6 · System Architecture

```
┌──────────────────┐        ┌───────────────────────┐        ┌──────────────┐
│  React frontend   │  HTTP  │   FastAPI backend     │  load  │ trained model │
│  (Vite, Tailwind) │ ─────► │  /predict /model-info │ ─────► │  (joblib)     │
│  Recharts charts  │        │  /statistics /history │        └──────────────┘
└──────────────────┘        │  + SQLite history     │
                            └───────────────────────┘
```

The model is loaded **once** at backend startup and shared across all requests — it is never retrained at inference time.

## 7 · Dataset

Two **public, citable** sources. Nothing is fabricated.

| Source | What | Purpose |
|---|---|---|
| 🌐 **Phishing Site URLs** (Kaggle; HF mirror `alexkstern/phishing_urls`) | ~507k URLs with `label` (0 = legitimate, 1 = phishing) | Main corpus |
| 🏆 **Tranco top-sites list** (`tranco-list.eu`) | the ~80k most-visited legitimate domains | Fixes the "bare homepage" class imbalance (the corpus contains almost no path-less legitimate homepages) |

**Final merged dataset: 667,127 unique URLs** (~552k legitimate · ~114k phishing).

### How to obtain the data (already done, but reproducible)

```bash
python -m ml.fetch_dataset      # downloads missing files into data/raw/
```

Files in `data/raw/`:

- `train.csv`, `test.csv` — main corpus (URL + label)
- `legit_homepages.csv` — Tranco legitimate homepages (url + label)

> Prefer a manual download? Grab `phishing_site_urls.csv` from
> <https://www.kaggle.com/datasets/arifmia/phishing-site-urls> and drop it into
> `data/raw/`. `ml/preprocessing.py` auto-detects `url`/`label`, `url`/`status`
> (good / bad) or `text`/`label` columns.

## 8 · Feature Engineering

`ml/feature_extractor.py` is the **single source of truth**. One URL → **32 numeric features**:

> `url_length · hostname_length · domain_length · tld_length · path_length · query_length ·
> num_params · num_dots · num_hyphens · num_underscores · num_slashes · num_question_marks ·
> num_equals · num_at · num_and · num_percent · num_hash · num_plus · num_special_chars ·
> num_digits · num_letters · num_subdomains · has_https · has_ip_address · has_at_symbol ·
> has_hex_string · has_suspicious_keywords · suspicious_keywords_count · digit_ratio ·
> special_char_ratio · is_shortened · tld_is_suspicious`

**Two correctness-critical design decisions:**

- 🌐 **Scheme normalization** — the public corpus stores URLs without `https://`; structural features are therefore computed on the scheme-stripped URL in training **and** prediction (eliminates train/serve skew; HTTPS is shown as a rule-based cue).
- 🔒 **No crawling** — the URL is treated purely as **text**. PhishGuard never visits, downloads from, or executes anything tied to the submitted URL.

## 9 · Machine-Learning Algorithms

| Model | Why it is here |
|---|---|
| 🔢 **Logistic Regression** | simple, interpretable linear baseline (needs scaled features → `StandardScaler` pipeline) |
| 🌳 **Decision Tree** | interpretable non-linear baseline |
| 🌲 **Random Forest** 🌟 | bagged ensemble; strong on tabular data; native feature importances |
| ⚡ **XGBoost** | boosted-tree ensemble; usually the strongest of the four |

All models are trained with `random_state = 42` for reproducibility.

## 10 · Training Process

```bash
python -m ml.train          # full pipeline below
python -m ml.train --force  # force re-extraction of features
```

1. load / clean / de-duplicate the dataset (`ml/preprocessing.py`)
2. extract features with `ml/feature_extractor.py`
3. stratified **80 / 20** train–test split (seed 42 → 533,735 / 133,434)
4. fit LR · DT · RF · XGBoost
5. evaluate on the **held-out test set**
6. choose the best model by **score = F1 + ROC-AUC**
7. write charts → `ml/evaluation/*.png` + `model_results.json`
8. save the winner → `models/phishguard_model.joblib` + `model_meta.json`

## 11 · Evaluation & Real Results

Metrics: **Accuracy · Precision · Recall · F1-score · ROC-AUC**, plus confusion matrix, ROC curves, feature importance and a model comparison chart.

**Actual test-set results (real numbers, Random Forest selected):**

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 90.3% | 87.3% | 50.7% | 0.641 | 0.894 |
| Decision Tree | 93.6% | 87.4% | 73.4% | 0.798 | 0.962 |
| **Random Forest** 🏆 | **94.6%** | **92.1%** | 75.2% | **0.828** | **0.976** |
| XGBoost | 94.4% | 89.9% | 75.7% | 0.822 | 0.974 |

*(These values update automatically whenever you re-run `python -m ml.train`.)*

## 12 · Screenshots

Capture screenshots and place them in `docs/screenshots/`:

```text
docs/screenshots/home.png        # hero + detector
docs/screenshots/result.png      # verdict card + risk meter
docs/screenshots/insights.png    # model charts
docs/screenshots/dashboard.png   # analysis dashboard
```

Then drop them in like:

```markdown
![Home](docs/screenshots/home.png)
```

## 13 · Installation

**Requirements:** Python 3.10+ · Node.js 18+ · npm.

```bash
# backend + ML
cd phishguard-ai
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt

# frontend
cd frontend
npm install
```

## 14 · How to Run

```bash
# 1) (optional) fetch the public dataset          → data/raw/
python -m ml.fetch_dataset

# 2) train + evaluate + save the model            → models/ + ml/evaluation/
python -m ml.train

# 3) start the API  (interactive docs at /docs)   → http://127.0.0.1:8000
python -m uvicorn backend.app.main:app --port 8000

# 4) start the web app                            → http://127.0.0.1:5273
cd frontend
npm run dev
```

Try the model from the command line without the UI:

```bash
python -m ml.predict "https://example.com"
python -m ml.predict "https://paypal.com-usa.security.login.verify/"
```

## 15 · API Documentation

Interactive docs: <http://127.0.0.1:8000/docs>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/predict` | Analyze one URL |
| `POST` | `/api/v1/predict/batch` | Analyze up to 50 URLs |
| `POST` | `/api/v1/predict/model/{name}` | Analyze one URL with a specific model (Playground) |
| `POST` | `/api/v1/predict/simulate` | Score an edited feature vector (What-if, flagged hypothetical) |
| `GET` | `/api/v1/health` | Liveness + model status |
| `GET` | `/api/v1/model-info` | Training summary, metrics, ROC, confusion matrix, feature importance |
| `GET` | `/api/v1/models` | Deployed models + their test metrics |
| `GET` | `/api/v1/model-health` | Model status, version, training info |
| `GET` | `/api/v1/statistics` | Dashboard totals from SQLite history |
| `GET` | `/api/v1/history?q=&prediction=&limit=` | Search / filter recent analyses |
| `DELETE` | `/api/v1/history/{analysis_id}` | Delete one analysis |
| `DELETE` | `/api/v1/history` | Clear local history |

### Example

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
  "analysis_id": "PG-4F2A91C07B3E",
  "model_name": "Random Forest",
  "features": { "...": "32 numeric URL features..." },
  "security_analysis": ["8 explainable verdict cards"],
  "explanation": ["what actually moved the score"],
  "url_anatomy": { "components": ["protocol, subdomain, domain, path, query"] },
  "threat_dna": { "categories": { "Keyword Suspicion": 100.0 } }
}
```

## 16 · Project Structure

```
phishguard-ai/
├── frontend/            React + TypeScript + Tailwind + Recharts UI
│   └── src/pages/       Home (scanner) · Playground · Insights · PhishingLab · Dashboard · ApiLab
├── backend/             FastAPI app
│   └── app/             main.py · routes/ · database.py (SQLite) · config.py · schemas.py
├── ml/                  ★ the machine-learning pipeline
│   ├── fetch_dataset.py      download public datasets
│   ├── preprocessing.py      clean → features (data/processed)
│   ├── feature_extractor.py  ★ 32 URL features (training AND inference)
│   ├── analysis.py           URL Anatomy + Threat DNA (from real features/stats)
│   ├── train.py              train LR/DT/RF/XGB → evaluate → save all models
│   ├── evaluate.py           metrics + charts + model_results.json
│   ├── model.py              load-once inference + explainability + What-if
│   └── predict.py            CLI inference
├── data/
│   ├── raw/              public datasets (see §7)       [gitignored]
│   └── processed/        features.csv + dataset_summary.json  [gitignored]
├── models/               best model + all_models.joblib + model_meta.json  [gitignored]
├── notebooks/            optional EDA notebooks
├── tests/                pytest suite — 64 tests
├── docs/                 project_report.md · viva_questions.md · presentation_outline.md · demo_script.md
├── requirements.txt
├── .gitignore
└── README.md
```

## 17 · Testing

```bash
python -m pytest tests -q    # → 64 passed
```

Covers: URL feature extraction, label coercion, invalid-URL handling, model-loading errors, `/predict` response format, `/model-info` metrics, statistics & history, URL anatomy / Threat DNA fields, per-model prediction, the What-if simulation endpoint, model health, history search/filter/delete, and the guarantee that **training and inference share identical feature columns**.

## 18 · Limitations

- Uses **only URL structure** — page content, TLS certificates and reputation are not inspected (by design: defensive, never crawls).
- The corpus stores URLs **without schemes**; HTTPS is therefore a rule-based indicator on the UI, not a strong model feature.
- A short URL or a high number of hyphens may occasionally cause false positives on unusual-but-legitimate sites.
- The model estimates **probability, never certainty**.

## 19 · Future Improvements

- Content-based features (HTML title / brand matching) via safe, opt-in crawling.
- Live verification against PhishTank / Google Safe Browsing APIs.
- Browser extension that warns users at the moment of clicking.
- Attention-aware deep models (after the tabular baseline is understood).
- Model calibration (Platt scaling) for sharper probabilities.

## 20 · Team Members

| Name | Role | Contributions |
|---|---|---|
| **Maddur Vignesh** | Author · ML Engineer · Backend | dataset pipeline, feature engineering, model training & evaluation, FastAPI backend |
| **Mithra Rajeev** | Frontend Engineer · Documentation | React + Tailwind UI, charts & animations, README/docs, demo support |

---

<div align="center">

### 🛡️ *Detect phishing before it detects you.*

Made with ❤️ and supervised Machine Learning — Python, scikit-learn, FastAPI & React.

</div>

---

> ⚠️ **Disclaimer.** PhishGuard AI is an educational defensive-security project.
> Predictions are probabilistic estimates from a trained model — **never certainty**.
> Always verify web destinations before entering credentials. The application
> never visits, crawls, or executes any submitted URL.