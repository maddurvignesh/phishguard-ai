# PhishGuard AI — Live Demo Script (5–7 minutes)

> A prepared 5–7 minute walkthrough. Practice it twice before the evaluation —
> the goal is to look confident, not rushed.

## Before you start
- Start the backend: `python -m uvicorn backend.app.main:app --port 8000`
- Start the frontend: `cd frontend && npm run dev` (opens on `http://127.0.0.1:5273`)
- Confirm both are up: the navbar dot is green, a quick test scan works.
- Have a browser tab ready with **Model Lab** and the **API** `http://127.0.0.1:8000/docs` in the background.

---

## 1 · Open PhishGuard (0:00–0:20)
> "PhishGuard AI detects phishing URLs before they reach you. It's a supervised
> machine-learning system that reads a URL's structure and scores how likely it
> is to be a phishing link — and it explains why."

## 2 · Explain the problem (0:20–0:50)
> "90%+ of security incidents start with phishing. Attackers send links that
> look like a bank or email provider, hosted on lookalike domains the eye can't
> reliably judge. Our model learns the fingerprints of those URLs."

## 3 · Run the first scan (0:50–1:30)
- Paste `https://www.paypal.com/` → **ANALYZE WEBSITE**
- Narrate the scanning steps as they appear (UX only; the real prediction is
  computed by the backend).
- Show the green result, low risk, high confidence.

## 4 · Show a phishing catch (1:30–2:10)
- Paste `https://paypal.com-usa.security.login.verify.webscr/` → analyze.
- Point at the **risk meter**, the **CRITICAL** badge, and the Analysis ID.
- Say: "This URL was never visited — it was scored as text by the Random
  Forest model on 32 extracted features."

## 5 · URL Anatomy (2:10–2:40)
- Scroll to **URL Anatomy**. Hover the components.
- "The model split the URL into protocol, subdomain, domain, path, query — and
  flagged the deceptive subdomain stack and the suspicious path keywords."

## 6 · Threat DNA (2:40–3:00)
- Scroll to **Threat DNA**. Show the radar.
- "These are heuristic summaries of the model's own class statistics — not
  official threat-intelligence scores. Keyword suspicion here is extreme."

## 7 · Explainability (3:00–3:20)
- Scroll to **Why this classification?**.
- "Each feature shows the observed value vs. the typical legitimate baseline.
  Nothing is invented — it comes from real per-class statistics."

## 8 · What-if simulation (3:20–3:45)
- Toggle **HTTPS ON**, set **subdomains to 0**, clear **keywords**, run the
  simulation.
- "The same model on the edited feature vector drops the risk — proof that the
  decisions are driven by the features, and clearly labelled hypothetical."

## 9 · Model Playground (3:45–4:20)
- Open **Model Playground**. Run the same phishing URL on all four models.
- "The models genuinely disagree — Logistic Regression and Decision Tree call
  it clean, Random Forest and XGBoost flag it. That's why we never promise
  certainty."

## 10 · Model Lab (4:20–5:00)
- Open **Model Lab**. Show **Model Health** (READY, dataset size, features).
- Scroll the comparison chart and ROC curve.
- "Random Forest was selected by F1 + ROC-AUC, not accuracy — 94.6% accuracy
  is only part of the story; recall 75% and AUC 0.976 matter more for security."

## 11 · History / Analytics (5:00–5:30)
- Open **Analytics**. Show the live stats and history table.
- "Everything here is real: totals, flag rate, high-risk count, and each record
  keeps its model and Analysis ID. You can search and filter."

## 12 · Phishing Lab (5:30–5:50)
- Open **Phishing Lab**. Let the audience guess one case, then reveal.
- "Educational inputs only — users compare their own judgment with the model."

## 13 · API Lab (5:50–6:10)
- Open **API Lab**, press **Try**, copy the response.
- "Any developer can call `POST /api/v1/predict` — request and response shown
  here live. Full docs at `/docs`."

## 14 · Conclude (6:10–7:00)
> "PhishGuard is an explainable, defensive, machine-learning platform: a real
> trained Random Forest on ~667k URLs, honest metrics, and every verdict comes
> with a reason. Detect phishing before it detects you."

---

## Backup lines if something breaks
- **Backend down** → "One moment — restarting the model service." Keep the
  terminal close.
- **Model missing** → run `python -m ml.train`, mention it only regenerates the
  same artifacts with seed 42.
- **Demo URL misclassified** → "Perfect teaching moment — the model is
  probabilistic. That's exactly the limitation we document."
