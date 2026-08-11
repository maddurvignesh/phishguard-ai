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

---

## Intermediate & Evaluation

### 36. What is the bias-variance tradeoff?
Bias is how far a model's average prediction is from truth (simple models are
high-bias). Variance is how much predictions change across datasets (complex
models are high-variance). A decision tree that memorizes the data has high
variance; a linear model on a non-linear problem has high bias. Random Forest
reduces variance by averaging many trees.

### 37. What is underfitting?
When the model is too simple to capture the pattern — high error on both
training and test data. Opposite of overfitting. We tune depth / trees to land
between the two.

### 38. What is K-fold cross-validation?
Split the data into K folds, train on K−1, test on the remaining one, repeat K
times, average the results. More stable than one split. We used a single
stratified 80/20 split for the final model but cross-validation is the correct
tool for comparing hyperparameters.

### 39. Why is stratified splitting important here?
The dataset is imbalanced (~83% legitimate). A plain random split could give an
unlucky fold. Stratification keeps the same class ratio in train and test, so
the measured recall is trustworthy.

### 40. What is class imbalance and how does it affect metrics?
When one class (legitimate) vastly outnumbers the other (phishing). A model can
reach high accuracy by predicting the majority class. That is why we report
precision/recall/F1/ROC-AUC and select the model by F1 + AUC rather than
accuracy.

### 41. What is data leakage?
When information from the test set (or from the future) reaches the model
during training, inflating scores. We prevent it by splitting *before* training
and fitting the StandardScaler inside the model pipeline on training data only.
No test rows are ever used to fit anything.

### 42. What is probability calibration?
Whether a predicted 0.8 really means "80% of similar cases are positive".
Random Forest probabilities are often not perfectly calibrated. We therefore
call our risk score a "model probability estimate" rather than a true
calibrated probability.

### 43. What is SHAP and why didn't we use it here?
SHAP explains each prediction by attributing a contribution to every feature.
It is accurate but slow on 600 MB Random Forest with 250 trees at interactive
speed. We used the model's native feature importances plus per-class statistics
instead — transparent and honest, with the same training data behind it.

### 44. What is the difference between global and local explanation?
Global: "over all URLs, which features matter most?" (feature importance).
Local: "for THIS URL, why did the model lean phishing?" (our explanation panel
and What-if simulation).

### 45. What is gradient boosting?
Boosting trains weak models sequentially, each correcting the previous one's
errors. XGBoost is a highly optimized gradient-boosted tree implementation —
generally the strongest of the four, here marginally behind Random Forest on F1.

### 46. What is an ensemble and why does it help?
An ensemble combines many weak learners into one strong predictor. Random
Forest (bagging) averages many trees trained on random samples/features; this
reduces variance and almost always beats a single tree.

### 47. What is a decision boundary and where is it?
The region where the model's probability equals the threshold (0.5 here).
Points on one side become "phishing", the other "legitimate". Linear models
draw a straight boundary; trees draw piecewise-rectangular ones.

### 48. What is regularization, and where is it used?
Regularization penalizes complex models to prevent overfitting. Logistic
Regression uses an L2 penalty controlled by `C`; trees use `max_depth` and
`min_samples_split` as a structural regularizer.

### 49. What is ROC-AUC vs precision-recall (PR)?
ROC plots TPR vs FPR and stays optimistic on imbalanced data. PR plots
precision vs recall and is more informative when the positive class is rare —
which is exactly our phishing class. High ROC-AUC (0.976) plus decent F1 is a
strong practical result.

### 50. How do you know the model isn't just memorizing the dataset?
The metrics come from a held-out test set the model never saw. We also check
that Random Forest ≈ XGBoost on unseen data (both ~0.97 AUC) rather than one
model wildly outperforming on train and collapsing on test.

### 51. What is a threshold, and how could we tune it?
The 0.5 threshold decides the hard label from the probability. Lowering it
raises recall (catches more phishing) at the cost of more false alarms; raising
it does the opposite. An operating-point choice the UI currently leaves at 0.5.

### 52. Why is the What-if simulation scientifically honest?
It re-runs the real model on an edited *feature vector* — the output is a real
prediction, not a guess. It never claims to have changed the actual website and
is explicitly labelled "hypothetical simulation".

### 53. How would phishing evolve against this system?
Attackers can register new domains, shorten URLs, or remove obvious keywords to
dodge the statistical profile. That is why the model is probabilistic, why we
document limitations, and why retraining on fresh data is a listed future step.

### 54. What is reproducibility and how is it achieved here?
Re-running the pipeline with the same seed (42), same split, same models and
the saved feature matrix produces identical metrics — verified by the real
numbers matching across runs.

### 55. What would you change if you had 6 more months?
Add a PR-curve-based operating-point study, Platt scaling, a browser extension,
live threat-intelligence lookups, SHAP on a distilled surrogate, and a
streaming retraining pipeline with versioned artifacts.