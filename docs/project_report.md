# PhishGuard AI — Project Report

**An Intelligent Phishing Website Detection System using Supervised Machine Learning**

---

## Abstract

Phishing is one of the most common and damaging cyber-attacks on the internet.
Attackers create fake websites that impersonate trusted services and lure
victims into revealing credentials. This project presents **PhishGuard AI**,
a supervised Machine-Learning system that inspects a website's URL string and
estimates how likely it is to be phishing. URLs are converted into 32
transparent features — length, character composition, subdomains, HTTPS,
suspicious keywords, IP hosts, URL shorteners and more — and scored by a
Random Forest classifier trained on ~667,000 real URLs. The best model
achieves **94.6% accuracy, 75.2% recall and 0.976 ROC-AUC** on a held-out test
set, and is exposed through a FastAPI backend and a polished, responsive
React dashboard that shows the prediction, an animated risk meter, a per-cue
security analysis and an honest explanation of the result.

## 1. Introduction

URLs are the entry point of most attacks. Even security-conscious users are
poor at spotting `paypal.com-usa.security.verify…`. Machine learning offers a
practical defense: learn statistical patterns of phishing URLs from a large
labelled corpus, then evaluate new URLs in milliseconds. PhishGuard AI is
deliberately **explainable and academic** — every step from dataset to deployed
service is documented and reproducible.

## 2. Problem Statement

Design and implement an ML web application that, given an arbitrary URL,
classifies it as **legitimate** or **phishing** with a risk score, confidence,
and interpretable reasoning, without ever visiting the website.

## 3. Existing System

Thousands of phishing sites launch daily. Traditional defenses include manual
blacklists (PhishTank), browser safe-browsing APIs, and simple heuristics
(e.g. "has https" or "contains login"). These have drawbacks: blacklists lag
new campaigns, heuristics produce many false positives, and none explain their
verdicts to users. A trained model generalizes to never-seen URLs using the
*statistics* of an entire corpus.

## 4. Proposed System

PhishGuard AI replaces rigid rules with a learned decision boundary:

1. A URL is reduced to numeric features (feature engineering).
2. A trained classifier outputs P(phishing).
3. The probability is mapped to Risk Level (LOW → CRITICAL).
4. The UI explains which features moved the score.

## 5. Objectives

- Reproducible supervised-learning pipeline (fixed seed, 80/20 split).
- Feature extractor shared between training and inference (no train/serve skew).
- Comparison of Logistic Regression, Decision Tree, Random Forest, XGBoost.
- Selection by **F1 + ROC-AUC** rather than accuracy alone.
- Real, verifiable metrics everywhere in the UI.
- Professional responsive cybersecurity UX.

## 6. Methodology

1. **Data acquisition** — public Phishing Site URLs corpus (507k rows) merged
   with the Tranco top-80k legitimate domains (667k URLs total).
2. **Cleaning** — standardize columns (`text/label`, `url/status`, …), remove
   duplicates, drop unparseable rows.
3. **Feature engineering** — 32 structural features per URL
   (`ml/feature_extractor.py`), computed once for training and re-used verbatim
   for live prediction.
4. **Modeling** — LR (scaled), DT, RF, XGB; stratified 80/20 split, seed 42.
5. **Evaluation** — accuracy/precision/recall/F1/AUC, confusion matrix, ROC,
   feature importance, model comparison; best = **Random Forest**.
6. **Deployment** — joblib serialization; FastAPI loads the model once; React
   frontend; SQLite history.

## 7. Dataset Description

| Attribute | Value |
|---|---|
| Sources | Phishing Site URLs (Kaggle/HF) + Tranco top-list |
| Total URLs | 667,127 (after deduplication) |
| Legitimate / Phishing | 552,882 / 114,287 |
| Classes | binary (0 = legitimate, 1 = phishing) |
| Features extracted | 32 numeric |
| Train / Test split | 533,735 / 133,434 (80/20, stratified, seed 42) |

## 8. Feature Extraction

Examples of the 32 features: `url_length`, `hostname_length`, `num_dots`,
`num_hyphens`, `num_subdomains`, `has_https`, `has_ip_address`,
`has_at_symbol`, `suspicious_keywords_count`, `is_shortened`,
`tld_is_suspicious`, `digit_ratio`, `special_char_ratio`, `path_length`,
`query_length`, `num_params`, … Full, ordered list in `FEATURE_COLUMNS`
in `ml/feature_extractor.py`.

An important data-quality insight discussed in the viva: the public corpus
stores URLs *without* a scheme, so HTTPS never appears during training. We
therefore compute structural features on the scheme-stripped URL in both
training and inference (preventing train/serve skew) and keep HTTPS as a
transparent rule-based cue shown on the result page.

## 9. Algorithms

- **Logistic Regression** — linear decision boundary; standardized features.
- **Decision Tree** — axis-parallel greedy learner; interpretable.
- **Random Forest** — bagging of deep trees; variance reduction; feature
  importances. **Chosen best.**
- **XGBoost** — gradient-boosted trees; strongest baseline, near-RF performance.

## 10. System Architecture

See README §6. React (Vite/Tailwind/Recharts) → FastAPI
(`/predict`, `/model-info`, `/statistics`, `/history`) → joblib model +
SQLite. Model loaded once per process.

## 11. Implementation

Core files: `ml/preprocessing.py`, `ml/feature_extractor.py`, `ml/train.py`,
`ml/evaluate.py`, `ml/model.py`, `backend/app/main.py + routes/*`,
`frontend/src/pages/*`. Tests: 58 pytest cases in `tests/`.

## 12. Results

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 90.3% | 87.3% | 50.7% | 0.641 | 0.894 |
| Decision Tree | 93.6% | 87.4% | 73.4% | 0.798 | 0.962 |
| **Random Forest** | **94.6%** | **92.1%** | 75.2% | **0.828** | **0.976** |
| XGBoost | 94.4% | 89.9% | 75.7% | 0.822 | 0.974 |

The Random Forest was selected by score = F1 + ROC-AUC (1.804) despite
XGBoost having comparable metrics — balanced performance with simpler
interpretability (native feature importances).

## 13. Limitations

- URL-only features (no content/source-code signals, by design).
- HTTPS feature low variance in the corpus → rule-based in UI.
- Possibility of false positives on short/unusual legitimate domains.
- Predictions are probabilities, never certainty.

## 14. Future Scope

- Certified-content crawling (brand-name matching) with explicit user consent.
- PhishTank / Google Safe Browsing live lookups.
- Browser extension; model quantization for edge deployment.
- Probability calibration and threshold tuning.

## 15. Conclusion

PhishGuard AI demonstrates a complete, honest ML product lifecycle: real data,
careful feature engineering, rigorous evaluation with multiple metrics, model
selection beyond accuracy, serialization, a defensive API, and a beautiful
accessible UI — with 1,000 ms-level inference and full explainability for the
user.

## 16. References

1. Ma, J., Saul, L. K., Savage, S., Voelker, G. M. (2009). *Beyond blacklists:
   learning to detect malicious web sites from suspicious URLs.* KDD.
2. Arifmia — *Phishing Site URLs dataset*, Kaggle.
   https://www.kaggle.com/datasets/arifmia/phishing-site-urls
3. Tranco — *A research-oriented top sites ranking hardened against
   manipulation.* https://tranco-list.eu
4. Sahingoz et al. (2019). *Machine learning based phishing detection from
   URLs.* Expert Systems with Applications.
5. scikit-learn documentation. https://scikit-learn.org
6. API, A. (2024). *PhiUSIIL Phishing URL dataset.* UCI ML Repository.