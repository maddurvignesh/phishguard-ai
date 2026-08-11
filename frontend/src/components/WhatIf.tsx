import { useState } from 'react'
import { ArrowRight, FlaskConical, Loader2, SlidersHorizontal } from 'lucide-react'
import { simulateFeatures } from '../lib/api'
import type { PredictionResult } from '../lib/types'

interface Props {
  result: PredictionResult
}

interface Toggle {
  key: string
  label: string
  kind: 'toggle' | 'number'
  min?: number
  max?: number
}

const CONTROLS: Toggle[] = [
  { key: 'has_https', label: 'HTTPS enabled', kind: 'toggle' },
  { key: 'has_ip_address', label: 'Raw IP host', kind: 'toggle' },
  { key: 'is_shortened', label: 'URL shortener', kind: 'toggle' },
  { key: 'num_subdomains', label: 'Subdomains', kind: 'number', min: 0, max: 6 },
  { key: 'suspicious_keywords_count', label: 'Suspicious keywords', kind: 'number', min: 0, max: 8 },
]

export default function WhatIf({ result }: Props) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {}
    CONTROLS.forEach((c) => (base[c.key] = Number(result.features[c.key] ?? 0)))
    return base
  })
  const [sim, setSim] = useState<{ risk: number; level: string; prediction: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSimulation() {
    setLoading(true)
    setError(null)
    const edited = { ...result.features, ...values }
    try {
      const res = await simulateFeatures(edited, result.model_name)
      setSim({
        risk: res.risk_score_percent,
        level: res.risk_level,
        prediction: res.prediction,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  const changed = CONTROLS.filter((c) => values[c.key] !== Number(result.features[c.key] ?? 0))

  return (
    <div className="glass p-5">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-100">
        <FlaskConical className="h-4 w-4 text-cyan-300" /> What-if analysis
      </h3>
      <p className="mt-1 text-[11px] text-mist">
        Hypothetical feature simulation — edits the feature vector and re-scores it with the real
        model. It does NOT modify the actual website.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTROLS.map((c) => (
          <label key={c.key} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-[#0a1120]/70 px-3 py-2.5">
            <span className="text-xs text-slate-300">{c.label}</span>
            {c.kind === 'toggle' ? (
              <button
                type="button"
                role="switch"
                aria-checked={values[c.key] === 1}
                onClick={() => setValues((v) => ({ ...v, [c.key]: v[c.key] === 1 ? 0 : 1 }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${values[c.key] === 1 ? 'bg-cyan-500' : 'bg-[#152136]'}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${values[c.key] === 1 ? 'left-4.5' : 'left-0.5'}`}
                />
              </button>
            ) : (
              <input
                type="number"
                min={c.min}
                max={c.max}
                value={values[c.key]}
                onChange={(e) => setValues((v) => ({ ...v, [c.key]: Number(e.target.value) }))}
                className="w-16 rounded-md border border-edge bg-[#080e1c] px-2 py-1 font-mono text-xs text-cyan-200 outline-none focus:border-cyan-500/60"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={runSimulation} disabled={loading} className="btn-cyber inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
          Run simulation
        </button>
        {changed.length > 0 && (
          <span className="font-mono text-[10px] text-amber-300">
            {changed.length} feature(s) changed
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      {sim && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-edge bg-[#0a1120]/70 p-4">
            <div className="text-[10px] uppercase tracking-widest text-mist">Original assessment</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-200">
              {result.risk_score_percent.toFixed(0)}% <span className="text-sm font-semibold text-mist">{result.risk_level}</span>
            </div>
            <div className="text-xs text-mist">{result.prediction}</div>
          </div>
          <div className="rounded-xl border border-edge bg-[#0a1120]/70 p-4">
            <div className="text-[10px] uppercase tracking-widest text-mist">Hypothetical assessment</div>
            <div className={`mt-1 font-display text-2xl font-bold ${sim.prediction === 'phishing' ? 'text-red-400' : 'text-emerald-400'}`}>
              {sim.risk.toFixed(0)}% <span className="text-sm font-semibold text-mist">{sim.level}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-mist">
              <ArrowRight className="h-3 w-3 text-cyan-300" /> simulated with {result.model_name}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
