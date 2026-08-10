# PhishGuard AI — Viva Questions & Answers

> 30+ likely viva questions with beginner-friendly, accurate answers.
> Read them twice: once to memorize the terms, once to *really* understand.

---

## Fundamentals

### 1. What is phishing?
A cyber attack where the attacker impersonates a trusted service (bank, email
provider, online store) to trick the victim into revealing sensitive data such
as passwords, card numbers or OTPs. Usually delivered via fake websites whose
URLs impersonate a real brand.

### 2. What is Machine Learning?
A field where we give a computer many examples (data) and let it learn a
pattern automatically, instead of programming explicit rules. Here, we give it
~667k URLs labelled "legitimate/phishing" and it learns which URL patterns
indicate phishing.

### 3. Why do we use Supervised Learning here?
Because we have **labelled data** — every URL in the dataset already has the
correct answer (0 or 1). Supervised learning learns the mapping
`features → label` from those examples. Unsupervised learning would find
groups/clusters, which is not what we want for a verdict.

### 4. What is Binary Classification?
Classification with exactly two output classes. Here: *legitimate* (0) vs
*phishing* (1). The model predicts a probability, then we threshold it at 0.5.

### 5. What is a feature? Why do we need feature extraction?
A feature is a numeric property describing one input. ML models only
understand numbers, not raw text. A URL `paypal.com-usa.verify/login` has no
meaning to a model as text — but "13 dots", "2 hyphens", "keywords=5" ARE
numbers it can learn from. Feature extraction converts the URL into a fixed
numeric vector (32 values here).

### 6. Why 32 features and not just "contains login"?
A single rule is brittle and never covers new tricks. 32 features let the
model combine many weak signals (dots plus missing HTTPS plus a shortening
service) into a strong decision, and it can discover combinations we never
explicitly wrote down.

### 7. Why is the feature extractor shared between training and prediction?
If training and prediction compute different features, the model receives
inputs it never saw during training (train/serve skew) and accuracy collapses.
We literally call the same function with the same column order in both places,
so a bug in one place is a bug in both — and a correct one stays correct.

### 8. Why did we strip the http/https scheme before extracting features?
The public dataset stores URLs without a scheme, so HTTPS never appears during
training. If we kept `https://` in live inputs, `url_length` and other raw
counts would systematically differ from training data and confuse the model.
We strip the scheme in both training and prediction, and show HTTPS separately
as a transparent rule-based indicator.

### 9. What is a "URL shortener" feature and why is it suspicious?
Shorteners (bit.ly, tinyurl…) hide the real destination behind a tiny link.
They are legitimate but heavily abused by phishers, so when the hostname is an
known shortener we set `is_shortened = 1` and the model treats it as a risk cue.

---

## Data & Preprocessing

### 10. Which dataset did you use?
The "Phishing Site URLs" corpus (Kaggle; ~507k URLs, label 0/1) merged with
the Tranco top-80k legitimate domains to fix the fact that the corpus almost
never contained bare, pathless legitimate homepages.

### 11. What data cleaning did you do?
Standardized column names, removed duplicates, dropped rows that could not be
parsed, normalized URL strings, and coerced all label spellings
(good/bad, legitimate/phishing) into 0/1.

### 12. Why did you augment with Tranco homepages?
Only 47 legitimate samples in the whole corpus had no path. Real users type
bare domains like `google.com`. Without augmentation the model wrongly decided
"no path → phishing". Adding 160k real popular homepages made the model
understand that such URLs are normally legitimate.

### 13. What is train/test splitting and why 80/20?
We held out 20% of the data the model never sees during training, so its
metrics reflect performance on *new* URLs, not memorization. 80/20 is a common
trade-off. Our split is **stratified** (same class ratio in train and test)
and uses a fixed `random_state=42` so results are reproducible.

### 14. Why a fixed random_state?
Without it, every run would use a different split and give slightly different
metrics, so nobody could reproduce our numbers. With seed 42 the experiment is
identical every time.

---

## Models

### 15. Which models did you compare?
Logistic Regression, Decision Tree, Random Forest, XGBoost.

### 16. Why Logistic Regression, and why did you scale its features?
It is a linear model: it learns a straight decision boundary. Linear models
are sensitive to feature scale (a feature with values 0–2000 dominates one with
0–1), so we standardize features (mean 0, variance 1). Tree models don't need
scaling because they split on thresholds, not weighted sums.

### 17. Difference between Decision Tree and Random Forest?
A Decision Tree is ONE greedy learner — low bias, high variance (overfits).
Random Forest trains many trees on **random subsamples of data and features**
(bagging), then averages their votes, which reduces variance a lot. That's why
RF beat the single tree (recall 75% vs 73%, AUC 0.976 vs 0.962).

### 18. What is the difference between bagging and boosting?
Bagging (Random Forest) trains trees in parallel on bootstrap samples and
averages. Boosting (XGBoost) trains trees **sequentially**, each new tree
fixing the errors of the previous ones. Boosting often achieves higher accuracy
but is more prone to overfitting and is harder to explain.

### 19. Why did you select Random Forest and not XGBoost?
Selection used score = **F1 + ROC-AUC**. Random Forest scored 1.804 vs XGBoost
1.796 — nearly identical, with RF giving higher precision (92.1% vs 89.9%) and
native, human-readable feature importances, plus fewer hyperparameters to tune.
This also shows we didn't pick blindly by accuracy.

### 20. What is overfitting?
When a model memorizes training data instead of learning the general pattern:
perfect training scores but poor test scores. We guard against it with an
out-of-sample test set, ensemble averaging, and by reporting test-set metrics
honestly instead of training-set ones.

---

## Evaluation

### 21. What is a confusion matrix?
A 2×2 table crossing actual vs predicted classes:

| | Predicted Legit | Predicted Phish |
|---|---|---|
| **Actual Legit** | True Negative | False Positive (alarm) |
| **Actual Phish** | False Negative (missed!) | True Positive |

It reveals the *type* of errors, which accuracy hides.

### 22. What is Precision?
Of everything the model called phishing, how many really were:
`TP / (TP + FP)`. We want high precision so we don't harass users of safe
sites. RF: 92.1%.

### 23. What is Recall (Sensitivity)?
Of all real phishing URLs, how many did we catch: `TP / (TP + FN)`.
This is critical — the whole point is catching attacks. RF: 75.2%.

### 24. What is F1-score?
The harmonic mean of precision and recall: `2·P·R/(P+R)`. It balances the two
and is ideal when classes are imbalanced. RF: 0.828.

### 25. Why is accuracy alone insufficient?
With 83% legitimate URLs, a model that *always* says "legitimate" scores 83%
accuracy while catching **zero** phishing — useless. Accuracy ignores the class
imbalance and the different costs of errors, so we use precision/recall/F1/AUC.

### 26. What is ROC-AUC?
The ROC curve plots True Positive Rate vs False Positive Rate across every
probability threshold; AUC is the area under it. It measures how well the model
*ranks* phishing above legitimate regardless of threshold. 0.50 = random,
0.976 (ours) = very strong.

### 27. What is feature importance?
For tree models, how much each feature reduces impurity/error across all
splits. It tells us the model's ranking: e.g. `tld_length`,
`suspicious_keywords_count`, `num_digits`, `num_dots`, `path_length` mattered
most. The UI shows these values directly from training — they aren't invented.

---

## Product & Limitations

### 28. How does the risk score relate to the model?
The model outputs P(phishing) in [0,1]. The UI displays it as a 0–100% risk
score and maps it to LOW (0–30), MEDIUM (30–60), HIGH (60–80), CRITICAL
(80–100). Confidence = max(P, 1−P), i.e. how close the model is to being sure.
We never claim certainty — the app calls it a *risk estimate*.

### 29. What does the "explanation" section show?
It compares the analyzed URL's top features against the real per-class means
stored from training (typical legitimate vs typical phishing values), weighted
by the model's own feature importances. So "why" is data-driven, not hand-written.

### 30. What are the limitations of URL-based detection?
(1) Only the string is used — content, certificates and reputation are ignored,
by design, for safety. (2) HTTPS shows weak variance in the corpus and is thus a
rule-based cue. (3) False positives can occur on short or hyphen-rich legitimate
domains. (4) Results are probabilistic, never certainty.

### 31. Did you visit or test the submitted URLs? Why not?
No. PhishGuard is a *defensive* tool — we treat every input URL as untrusted
text and never open a connection. Visiting suspicious URLs would turn a tester
into a victim; security-wise it would also leak our IP.

### 32. How can the system be improved?
Add opt-in content analysis (title/brand matching), live PhishTank / Safe
Browsing lookups, a browser extension, probability calibration (Platt scaling),
and continuous retraining on fresh feeds.

### 33. What is a train serve skew, and how did you avoid it?
When the features fed at prediction time differ from those used in training.
We avoided it by (a) one shared `extract_features()`, (b) identical canonical
column order stored in the model metadata, and (c) consistent scheme handling.
This is enforced by tests in `tests/test_feature_extractor.py`.

### 34. How would you deploy this for millions of users?
Load model once (already done), batch predictions, cache common URLs, move
history/hashing to a dedicated DB, add auth + autoscaling behind a load
balancer, and serve the React build from a CDN.

### 35. Why SQLite for history?
A single lightweight file with zero configuration — perfect for a local
dashboard. We store only the minimum (time, URL truncated, verdict, score)
and no personal information.