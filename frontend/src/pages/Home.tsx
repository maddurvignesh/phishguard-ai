import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flag,
  GitBranch,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Radar,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlink,
  XCircle,
} from 'lucide-react'
import RiskMeter from '../components/RiskMeter'
import { predictUrl } from '../lib/api'
import type { PredictionResult } from '../lib/types'

const SCAN_STEPS = [
  'Initializing security scan...',
  'Extracting URL features...',
  'Analyzing URL structure...',
  'Running Machine Learning model...',
  'Generating risk assessment...',
]

const STATUS_META = {
  safe: { icon: CheckCircle2, cls: 'text-emerald-400', label: 'Safe-looking characteristic' },
  warning: { icon: AlertTriangle, cls: 'text-amber-400', label: 'Warning signal' },
  suspicious: { icon: XCircle, cls: 'text-red-400', label: 'Suspicious signal' },
}

const CARD_ICONS: Record<string, typeof Lock> = {
  lock: Lock,
  keywords: KeyRound,
  ip: Globe,
  subdomains: GitBranch,
  length: Search,
  shortener: Unlink,
  special: Sparkles,
  tld: Flag,
}

const SAMPLE_URLS = [
  'https://www.google.com',
  'https://github.com/login',
  'https://www.paypal.com/',
  'https://tinyurl.com/abc123',
]

function scanExample(stepIndex: number, url: string): string {
  if (url.trim().length === 0) return ''
  const host = (() => {
    try {
      return new URL(url.includes('://') ? url : `https://${url}`).hostname
    } catch {
      return url
    }
  })()
  switch (stepIndex) {
    case 1:
      return `Parsing ${host.length <= 26 ? host : host.slice(0, 23) + '...'} and its ${(host.match(/\./g) || []).length + 1} host label(s)`
    case 2:
      return `Checking scheme, path depth, query parameters and character composition`
    case 3:
      return `Scoring 32 engineered features with the trained Random Forest classifier`
    case 4:
      return `Mapping probability to risk level and building the security profile`
    default:
      return ''
  }
}

const EMPTY_RESULT: PredictionResult | null = null

export default function Home() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<PredictionResult | null>(EMPTY_RESULT)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a website URL.')
      setResult(null)
      return
    }

    setScanning(true)
    setError(null)
    setResult(null)
    setStep(0)

    // UX-only progression; the real prediction is computed below and simply
    // revealed once the animation finishes. No fake values are ever returned.
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1))
    }, 620)
    const animationDone = new Promise((resolve) => setTimeout(resolve, SCAN_STEPS.length * 620))

    try {
      const [realResult] = await Promise.all([predictUrl(trimmed), animationDone])
      await new Promise((r) => setTimeout(r, 300))
      setResult(realResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      clearInterval(timer)
      setScanning(false)
    }
  }

  const isPhishing = result?.prediction === 'phishing'

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {/* ============ HERO ============ */}
      <section className="relative pt-14 pb-10 text-center sm:pt-20">
        <div className="grid-dashed absolute inset-x-0 top-0 h-40 opacity-40 [mask-image:linear-gradient(180deg,black,transparent)]" />
        <div className="chip mx-auto">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          AI-POWERED THREAT INTELLIGENCE
        </div>
        <h1 className="animate-fade-up mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
          PHISHGUARD <span className="text-gradient">AI</span>
        </h1>
        <p className="animate-fade-up-1 mt-4 font-display text-xl text-cyan-100 sm:text-2xl">
          Detect phishing before it detects you.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
          An intelligent Machine-Learning system that analyzes website characteristics and
          identifies potentially suspicious URLs — powered by a real trained Random Forest
          classifier evaluated on over <span className="font-semibold text-cyan-200">660,000 URLs</span>.
        </p>
        <a
          href="#detector"
          className="btn-cyber mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
        >
          <Radar className="h-4 w-4" /> Analyze a URL <ArrowRight className="h-4 w-4" />
        </a>
      </section>

      {/* ============ DETECTOR ============ */}
      <section id="detector" className="scroll-mt-24">
        <div className="glass animate-fade-up-2 p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30">
              <Radar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">URL Threat Detector</h2>
              <p className="text-xs text-mist">
                Enter any website address. Only the URL string is analyzed — the site is never visited.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Globe className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500/70" />
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="https://example.com"
                aria-label="Website URL"
                className="w-full rounded-xl border border-edge bg-[#0a1120]/80 py-3.5 pl-11 pr-4 font-mono text-sm text-slate-100 outline-none transition-colors placeholder:text-mist/50 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={scanning}
              className="btn-cyber inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              {scanning ? 'Analyzing...' : 'ANALYZE WEBSITE'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-mist/70">Try:</span>
            {SAMPLE_URLS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setUrl(s)
                  setError(null)
                }}
                className="chip hover:border-cyan-500/50 hover:text-cyan-200"
              >
                {s}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* scanning progress */}
          {scanning && (
            <div className="relative mt-6 overflow-hidden rounded-xl border border-edge bg-[#080e1c] p-5">
              <div className="scanbar absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" />
              <div className="relative space-y-3">
                {SCAN_STEPS.map((label, i) => {
                  const done = i < step
                  const active = i === step
                  return (
                    <div key={label} className="flex items-center gap-3">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? 'border-cyan-400' : 'border-edge'}`}>
                          {active && <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />}
                        </div>
                      )}
                      <span className={`text-sm ${done ? 'text-mist' : active ? 'text-cyan-200' : 'text-mist/40'}`}>
                        {label}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-mist/50">{scanExample(i, url)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ============ RESULT ============ */}
          {result && (
            <div className="animate-fade-up mt-8">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                <div className="space-y-5">
                  {/* summary card */}
                  <div className={`relative overflow-hidden rounded-2xl border p-6 ${isPhishing ? 'border-red-500/40 bg-gradient-to-br from-red-950/50 to-[#12070b]' : 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-[#07120b]'}`}>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isPhishing ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {isPhishing ? <ShieldAlert className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-display text-xl font-bold sm:text-2xl ${isPhishing ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isPhishing ? (
                            <span className="flex items-center gap-2"><span>🔴</span> POTENTIAL PHISHING WEBSITE</span>
                          ) : (
                            <span className="flex items-center gap-2"><span>🟢</span> LEGITIMATE WEBSITE</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-mist">
                          {isPhishing
                            ? 'Model detected characteristics commonly associated with phishing.'
                            : 'Low risk detected. Basic security characteristics look unremarkable.'}
                        </p>
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-mist/60">
                        Analyzed: {new Date().toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="chip">
                        <span className="font-mono">Risk Level</span>
                        <strong className={isPhishing ? 'text-red-400' : 'text-emerald-400'}>{result.risk_level}</strong>
                      </span>
                      <span className="chip">
                        <span className="font-mono">Model</span> <strong className="text-cyan-300">Random Forest</strong>
                      </span>
                      <span className="chip">
                        <span className="font-mono">Confidence</span> <strong className="text-cyan-200">{result.confidence_percent.toFixed(0)}%</strong>
                      </span>
                    </div>
                  </div>

                  {/* why flagged */}
                  <div className="glass p-5">
                    <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-100">
                      <Sparkles className="h-4 w-4 text-cyan-300" /> Why this classification?
                    </h3>
                    {result.explanation.length > 0 ? (
                      <ul className="mt-3 space-y-2.5">
                        {result.explanation.map((item) => (
                          <li key={item.feature} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-mist">{item.feature}:</span>
                            <span className="font-mono text-cyan-200">{item.value}</span>
                            <span className="text-mist/60">(typical legitimate ≈ {item.typical_legit.toFixed(1)})</span>
                            <span className="text-mist/40">·</span>
                            <span className={`font-mono text-xs ${item.direction === 'higher' ? 'text-amber-300' : 'text-sky-300'}`}>
                              {item.direction === 'higher' ? 'higher' : 'lower'} than legitimate baseline
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-mist">
                        No features deviated meaningfully from the legitimate baseline — the URL falls
                        within the normal range of safe browsing patterns.
                      </p>
                    )}
                  </div>
                </div>

                {/* risk meter column */}
                <div className="glass flex flex-col items-center justify-center gap-2 p-6">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-mist">Risk Score</span>
                  <RiskMeter percent={result.risk_score_percent} level={result.risk_level} />
                  <p className="max-w-[220px] text-center text-xs leading-relaxed text-mist/80">
                    {result.risk_level === 'LOW' && 'Low risk — likely safe, but always remain alert.'}
                    {result.risk_level === 'MEDIUM' && 'Medium risk — some phishing signals detected.'}
                    {result.risk_level === 'HIGH' && 'High risk — strong phishing characteristics.'}
                    {result.risk_level === 'CRITICAL' && 'Critical risk — treat as unsafe until proven otherwise.'}
                  </p>
                  <div className="mt-1 flex items-start gap-1.5 text-[10px] text-mist/60">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    Score = model probability estimate, not a guarantee.
                  </div>
                </div>
              </div>

              {/* ============ SECURITY ANALYSIS ============ */}
              <div className="mt-8">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold text-slate-100">
                  <Search className="h-4 w-4 text-cyan-300" /> URL Security Analysis
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {result.security_analysis.map((card) => {
                    const meta = STATUS_META[card.status]
                    const Icon = CARD_ICONS[card.icon] ?? Search
                    return (
                      <div key={card.feature} className="glass glass-hover animate-fade-up p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-300">{card.feature}</span>
                          <Icon className={`h-4 w-4 ${meta.cls}`} />
                        </div>
                        <p className="mt-2 text-sm text-mist">{card.message}</p>
                        <p className={`mt-2 font-mono text-[10px] uppercase tracking-wider ${meta.cls}`}>
                          {meta.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-100/80">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                Disclamer: predictions are probabilistic estimates from a Machine-Learning model.
                PhishGuard never claims certainty — always verify the destination before entering
                personal information.
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}