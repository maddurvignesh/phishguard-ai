# PhishGuard AI — Presentation Outline (12 Slides)

> Format: 10–12 slides, ~12 minutes (≈1 min/slide). Speaker notes below each
> slide are meant to be *spoken*, not read.

---

## Slide 1 — Title
**PhishGuard AI — Intelligent Phishing Website Detection**
"Detect phishing before it detects you."
Team names · Course / Semester

> **Speaker notes:** Good afternoon, everyone. PhishGuard AI is a complete
> machine-learning project that detects phishing websites by analyzing their
> URLs. It is a real, working system: a model trained on over six hundred
> thousand real URLs, wrapped in a professional web application. This
> presentation will walk you through the problem, the solution, and how we
> built and validated it.

---

## Slide 2 — The Problem
"90%+ of incidents start with phishing. One wrong click, one fake link,
credentials are gone."
Image: user vs `paypal.com-usa.security.verify…`

> **Speaker notes:** Phishing is a social engineering attack. Attackers send a
> link that looks like a bank or an email provider. The fake page is hosted on
> a lookalike domain. The user types their password, and it's stolen. The core
> problem is that users simply cannot reliably tell a real URL from a fake one
> by eye — and blacklists update too slowly.

---

## Slide 3 — Motivation
Why URLs?
- The URL is the first (and often only) thing a user sees before clicking.
- URL structure carries measurable "fingerprints" of phishing.
- Analysis can be instant and safe (no website needs to be opened).

> **Speaker notes:** The URL is the user's first line of defense. And it has
> real, measurable patterns — think of excessive dots, suspicious words like
> "login" or "verify", raw IP addresses, or link shorteners that hide the true
> destination. Crucially, we can analyze the URL as plain text — we never have
> to visit the site, which keeps our own tool safe.

---

## Slide 4 — Proposed Solution
Machine Learning on URL features: "Don't write rules — learn the pattern."
Pipeline diagram: URL → 32 features → trained classifier → risk score + explanation.

> **Speaker notes:** Instead of writing brittle rules like "phishing contains
> login", we feed a machine-learning model 667,000 labelled URLs. The model
> learns which combinations of features indicate phishing. For a new URL we
> extract the same 32 features and get back a probability of phishing, which
> we show as a risk score and risk level, with an explanation of what drove
> the decision.

---

## Slide 5 — System Architecture
```
React UI ──► FastAPI ──► Trained model (joblib) + SQLite history
      POST /predict        loaded ONCE at startup
```
Key idea: identical feature extraction in training and at prediction time.

> **Speaker notes:** Our architecture is simple and modular. A React
> TypeScript frontend talks to a FastAPI backend. The backend loads the saved
> Random Forest once when it starts — never retrains per request — and answers
> every `/predict` call in milliseconds. The same function that built the
> training matrix is re-used live, which eliminates an entire class of bugs
> called train-serve skew.

---

## Slide 6 — Dataset
- "Phishing Site URLs" corpus — ~507k URLs (HuggingFace mirror of a public Kaggle dataset).
- Merged with Tranco top-80k legitimate domains.
- **Final: 667,127 URLs ≈ 552,882 legitimate / 114,287 phishing** (label 0/1).

> **Speaker notes:** All data is public and citable. The main corpus gave us
> hundreds of thousands of real phishing and legitimate URLs. We discovered a
> data-quality problem: that corpus had barely any pathless legitimate
> homepages, so the model would have called Google.com phishing! We fixed it
> by adding the top 80,000 domains from the Tranco list — the standard,
> authoritative ranking of the world's most-visited legitimate sites.

---

## Slide 7 — Feature Engineering
32 features, e.g.:
- Structure: url_length, num_dots, num_hyphens, num_subdomains, path/query length
- Security cues: has_https, has_ip_address, has_at_symbol, is_shortened, suspicious TLD
- Semantics: suspicious_keywords_count (login/verify/secure…)
- Ratios: digit_ratio, special_char_ratio

> **Speaker notes:** Each URL becomes a vector of 32 numbers. Counts, flags and
> ratios. Words are not fed to the model — only numbers. Every feature is
> computed by one function that is shared between training and prediction, so
> both stages see exactly the same numbers. We also normalize the scheme
> consistently because our corpus stores URLs without "https://".

---

## Slide 8 — Machine-Learning Models
Compared 4 classifiers (80/20 stratified split, seed 42):
- Logistic Regression (linear baseline, scaled features)
- Decision Tree (interpretable)
- **Random Forest (ensemble — selected)** ✅
- XGBoost (boosting)

> **Speaker notes:** We trained four very different families of models: a
> linear model, a single tree, a bagged forest and a boosted one. All with the
> same 80/20 split and the same random seed, so the comparison is fair. The
> Random Forest won — and notably we chose it with proper metrics, not just
> accuracy.

---

## Slide 9 — Results (real test-set numbers)
| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 90.3% | 87.3% | 50.7% | 0.641 | 0.894 |
| Decision Tree | 93.6% | 87.4% | 73.4% | 0.798 | 0.962 |
| **Random Forest** | **94.6%** | **92.1%** | 75.2% | **0.828** | **0.976** |
| XGBoost | 94.4% | 89.9% | 75.7% | 0.822 | 0.974 |
Selection: score = F1 + ROC-AUC.

> **Speaker notes:** These numbers come straight from the held-out test set —
> the 20% of URLs the models never saw. Random Forest catches 75% of true
> phishing sites, and 94.6% overall accuracy. We selected it with score equal
> to F1 plus ROC-AUC, because on imbalanced data accuracy is misleading — a
> model that always says "legitimate" would score 83% accuracy while catching
> nothing.

---

## Slide 10 — Live Demo
- Enter a URL → BRIEF scanner animation → verdict card
- Risk meter (LOW→CRITICAL), confidence, 8 security-analysis cards
- "Why was this URL flagged?" explanation
- Model Insights page: accuracy/precision/recall/F1/AUC, confusion matrix, ROC, feature importance
- Dashboard: analysis totals + live history

> **Speaker notes:** Now for the live demo. Watch the scanning sequence — it's
> purely cosmetic. The verdict itself is real: every prediction comes from the
> trained model. Notice the risk meter, the confidence, and the eight security
> cards. The "Why flagged" section compares the URL against the actual
> statistics of typical legitimate and typical phishing URLs. And the Model
> Insights page shows the genuine evaluation charts for all four models.

---

## Slide 11 — Limitations & Future Work
Limitations (honest):
- URL-only signals (content, certificates, reputation excluded — by design, never crawls).
- HTTPS low variance in corpus → rule-based cue on UI.
- Possible false positives on short/unusual legitimate sites.
- Probabilistic, never certainty.

Future work:
- Opt-in content analysis (brand-name matching)
- PhishTank / Safe Browsing lookups
- Browser extension, model calibration, fresh-feed retraining

> **Speaker notes:** No system is perfect, and we're deliberately honest about
> ours. We only use the URL string; we never open the website itself. HTTPS
> barely appears in our dataset, so the interface shows it as a rule-based
> signal rather than a model feature. Future work: match page content against
> the claimed brand, add live blacklist lookups, and ship it as a browser
> extension to warn users at the moment of clicking.

---

## Slide 12 — Conclusion
- A complete, reproducible ML product: real data → careful features → rigorous evaluation → deployment.
- Huge practical step: catching 75% of phishing at the URL level with a "what/why" answer.
- PhishGuard AI: **"Detect phishing before it detects you."**
Thank you — questions welcome.

> **Speaker notes:** To summarize: we built a genuine end-to-end machine
> learning system — real public data, careful feature engineering, honest
> evaluation that goes beyond accuracy, a clean API, and a polished,
> user-friendly interface that explains its reasoning. Most importantly, the
> system is a defense tool: it inspects text, never visits suspicious sites.
> Thank you for listening — I'm happy to take questions, especially about the
> model selection and feature engineering we discussed.