import { useEffect, useState } from 'react'
import { Brain, FlaskConical, Globe, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { getModels, predictWithModel } from '../lib/api'
import type { ModelListItem, PredictionResult } from '../lib/types'

export default function Playground() {
  const [models, setModels] = useState<ModelListItem[]>([])
  const [url, setUrl] = useState('https://paypal.com-usa.security.login.verify.webscr/')
  const [results, setResults] = useState<PredictionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getModels()
      .then((r) => setModels(r.models))
      .catch(() => setModels([]))
  }, [])

  async function runAll() {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a website URL.')
      return
    }
    setLoading(true)
    setError(null)
    setResults([])
    const available = models.filter((m) => m.available).map((m) => m.name)
    const out: PredictionResult[] = []
    for (const name of available) {
      try {
        const r = await predictWithModel(name, trimmed)
        out.push(r)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'A model failed to respond')
      }
    }
    setResults(out.sort((a, b) => b.risk_score_percent - a.risk_score_percent))
    setLoading(false)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Model Playground</h1>
        <p className="mt-1 text-sm text-mist">
          Analyze the same URL with every trained classifier and watch the models disagree.
          Only real model outputs are shown.
        </p>
      </header>

      <div className="glass mt-6 flex flex-col gap-3 p-5 sm:flex-row">
        <div className="relative flex-1">
          <Globe className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500/70" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAll()}
            placeholder="https://example.com"
            aria-label="Website URL"
            className="w-full rounded-xl border border-edge bg-[#0a1120]/80 py-3.5 pl-11 pr-4 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>
        <button onClick={runAll} disabled={loading} className="btn-cyber inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {loading ? 'Scoring models...' : 'RUN ALL MODELS'}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((m) => {
          const r = results.find((x) => x.model_name === m.name)
          const metric = m.metrics
          return (
            <div key={m.name} className={`glass p-5 ${r && r.prediction === 'phishing' ? 'border-red-500/40' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display text-sm font-semibold text-slate-100">
                  <Brain className="h-4 w-4 text-cyan-300" /> {m.name}
                </span>
                <span className={`h-2 w-2 rounded-full ${r ? (r.prediction === 'phishing' ? 'bg-red-400' : 'bg-emerald-400') : 'bg-mist/40'}`} />
              </div>

              {r ? (
                <div className="mt-3">
                  <div className={`font-display text-3xl font-bold ${r.prediction === 'phishing' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {r.risk_score_percent.toFixed(0)}%
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm">
                    {r.prediction === 'phishing' ? (
                      <ShieldAlert className="h-4 w-4 text-red-400" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    )}
                    <span className={r.prediction === 'phishing' ? 'text-red-300' : 'text-emerald-300'}>
                      {r.prediction.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <span className="chip"><span className="font-mono">Risk</span> <strong className="text-slate-200">{r.risk_level}</strong></span>
                    <span className="chip"><span className="font-mono">Confidence</span> <strong className="text-cyan-200">{r.confidence_percent.toFixed(0)}%</strong></span>
                  </div>
                </div>
              ) : loading ? (
                <div className="mt-6 animate-pulse space-y-2">
                  <div className="h-6 w-16 rounded bg-white/5" />
                  <div className="h-3 w-24 rounded bg-white/5" />
                </div>
              ) : m.available ? (
                <p className="mt-3 text-xs text-mist">Waiting for analysis…</p>
              ) : (
                <p className="mt-3 text-xs text-amber-300">Model artifact not available.</p>
              )}

              {metric && (
                <div className="mt-4 border-t border-edge/60 pt-3 font-mono text-[10px] text-mist/80">
                  test F1 {metric.f1.toFixed(3)} · AUC {metric.roc_auc.toFixed(3)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {results.length > 0 && (
        <div className="glass mt-8 overflow-hidden">
          <div className="border-b border-edge px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-slate-100">Model Disagreement</h2>
            <p className="mt-0.5 text-xs text-mist">
              Same URL, four classifiers, real outputs. Disagreement between models is expected —
              it is why a single probability is never a certainty.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-thin w-full text-left text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-[10px] uppercase tracking-wider text-mist">
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Prediction</th>
                  <th className="px-5 py-3 font-medium">Risk score</th>
                  <th className="px-5 py-3 font-medium">Risk level</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.model_name} className="border-b border-edge/40">
                    <td className="px-5 py-3 font-semibold text-slate-200">{r.model_name}</td>
                    <td className={`px-5 py-3 ${r.prediction === 'phishing' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {r.prediction === 'phishing' ? 'PHISHING' : 'LEGITIMATE'}
                    </td>
                    <td className="px-5 py-3 font-mono text-cyan-200">{r.risk_score_percent.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-slate-300">{r.risk_level}</td>
                    <td className="px-5 py-3 font-mono text-mist">{r.confidence_percent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
