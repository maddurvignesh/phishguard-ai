import { useState } from 'react'
import { Eye, FlaskConical, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { predictUrl } from '../lib/api'
import type { PredictionResult } from '../lib/types'

interface LabCase {
  category: string
  url: string
  description: string
}

const CASES: LabCase[] = [
  { category: 'Normal-looking URL', url: 'https://www.google.com/search?q=weather', description: 'A clean, short, recognizable search URL.' },
  { category: 'Normal-looking URL', url: 'https://github.com/login', description: 'A well-known domain with a simple path.' },
  { category: 'Suspicious URL', url: 'https://secure-paypal-verification.com/login', description: 'A lookalike domain stuffed with trust words.' },
  { category: 'Long URL', url: 'https://www.amazon.com-verify-account.order-confirm.update.today/account/login?id=2f8a1c99&redirect=https://login.amazon.com', description: 'Very long address with many tokens.' },
  { category: 'Multiple subdomain URL', url: 'https://login.verify-account.paypal-security.example.com/reset', description: 'Deep subdomain nesting hides the true owner.' },
  { category: 'IP-based URL', url: 'http://192.168.10.25/secure/verify.php', description: 'Host is a raw IP address instead of a domain.' },
  { category: 'Special-character-heavy URL', url: 'https://free-crypto-gift.com/claim?promo=a1b2c3%21%40%23&ref=777&sig=!!@@##', description: 'Dense special characters and query parameters.' },
]

export default function PhishingLab() {
  const [choice, setChoice] = useState<Record<number, string>>({})
  const [revealed, setRevealed] = useState<Record<number, PredictionResult | null>>({})
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reveal(idx: number, url: string) {
    if (revealed[idx]) return
    setLoadingIdx(idx)
    setError(null)
    try {
      const r = await predictUrl(url)
      setRevealed((m) => ({ ...m, [idx]: r }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoadingIdx(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Phishing Lab</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          Educational test inputs. Make your own guess first, then reveal the model's assessment
          and compare. These are demonstration URLs — not verified malicious sites.
        </p>
      </header>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {CASES.map((c, i) => {
          const result = revealed[i]
          const guess = choice[i]
          return (
            <div key={i} className="glass flex flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="chip text-cyan-200">{c.category}</span>
                <span className="font-mono text-[10px] text-mist">case {String(i + 1).padStart(2, '0')}</span>
              </div>
              <code className="mt-3 break-all rounded-lg border border-edge bg-[#080e1c] px-3 py-2 font-mono text-xs text-slate-200">
                {c.url}
              </code>
              <p className="mt-2 text-xs text-mist">{c.description}</p>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-mist">Your guess:</span>
                {(['legitimate', 'phishing'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setChoice((m) => ({ ...m, [i]: opt }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                      guess === opt
                        ? opt === 'phishing'
                          ? 'bg-red-500/20 text-red-300 ring-red-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
                        : 'text-mist ring-edge hover:text-slate-200'
                    }`}
                  >
                    {opt === 'phishing' ? '🟠 Phishing' : '🟢 Legitimate'}
                  </button>
                ))}
                <button
                  onClick={() => reveal(i, c.url)}
                  disabled={loadingIdx === i}
                  className="btn-cyber ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                >
                  {loadingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  Reveal model
                </button>
              </div>

              {result && (
                <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${result.prediction === 'phishing' ? 'border-red-500/40 bg-red-500/10' : 'border-emerald-500/40 bg-emerald-500/10'}`}>
                  {result.prediction === 'phishing' ? (
                    <ShieldAlert className="h-6 w-6 shrink-0 text-red-400" />
                  ) : (
                    <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" />
                  )}
                  <div>
                    <div className={`font-display text-sm font-bold ${result.prediction === 'phishing' ? 'text-red-300' : 'text-emerald-300'}`}>
                      {result.prediction.toUpperCase()} · {result.risk_score_percent.toFixed(0)}% risk
                    </div>
                    <div className="text-[11px] text-mist">
                      {result.model_name} · {result.risk_level} · confidence {result.confidence_percent.toFixed(0)}%
                    </div>
                  </div>
                  {guess && guess === result.prediction && (
                    <span className="ml-auto rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-500/30">
                      You were right
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="glass mt-6 flex items-start gap-3 p-5">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
        <p className="text-xs leading-relaxed text-mist">
          A "normal-looking" URL can still be flagged and a flagged URL can be legitimate. The model
          estimates risk from URL structure alone — it cannot see page content. That is why you
          should always verify a destination before entering credentials.
        </p>
      </div>
    </main>
  )
}
