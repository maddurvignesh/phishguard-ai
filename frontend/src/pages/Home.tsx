import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Reveal from '../components/Reveal'
import RiskMeter from '../components/RiskMeter'
import ScrollProgress from '../components/ScrollProgress'
import SecurityCore from '../components/SecurityCore'
import ThreatDnaChart from '../components/ThreatDna'
import UrlAnatomyView from '../components/UrlAnatomy'
import WhatIf from '../components/WhatIf'
import { useInView } from '../hooks/useInView'
import { getModelHealth, getModelInfo, predictUrl } from '../lib/api'
import type { ModelHealth, ModelInfo, PredictionResult } from '../lib/types'

const SCAN_STEPS = [
  'PARSING URL',
  'EXTRACTING FEATURES',
  'RUNNING ML MODEL',
  'CALCULATING RISK',
  'GENERATING ANALYSIS',
]

const ANATOMY_PARTS = [
  { part: 'https://', label: 'PROTOCOL', suspicious: false },
  { part: 'login.verify-account', label: 'SUBDOMAIN', suspicious: true },
  { part: '.example.com', label: 'DOMAIN', suspicious: false },
  { part: '/reset', label: 'PATH', suspicious: true },
  { part: '?id=123', label: 'QUERY', suspicious: false },
]

const FEATURE_CHIPS = [
  'URL LENGTH', 'DOMAIN', 'SUBDOMAINS', 'HTTPS', 'SPECIAL CHARS',
  'KEYWORDS', 'DIGITS', 'PARAMETERS', 'DOT COUNT', 'PATH DEPTH',
]

const SAMPLE_URLS = [
  'https://www.google.com',
  'https://www.paypal.com/',
  'https://paypal.com-usa.security.login.verify.webscr/',
  'https://tinyurl.com/abc123',
]

const MODEL_TAGLINE: Record<string, string> = {
  'Logistic Regression': 'Linear baseline · interpretable',
  'Decision Tree': 'Single tree · rule-like',
  'Random Forest': 'Bagged ensemble · stable',
  XGBoost: 'Boosted trees · strongest fit',
}

function Counter({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 })
  const [n, setN] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!inView || done) return
    const target = value
    const dur = 1200
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, done])

  return (
    <div ref={ref} className="text-center">
      <div className="count-in font-display text-3xl font-bold text-white sm:text-4xl">
        {n.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-1 font-mono text-[10px] tracking-[0.3em] text-mist">{label}</div>
    </div>
  )
}

function ScanSteps({ step }: { step: number }) {
  return (
    <div className="space-y-2.5">
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
            <span className={`font-mono text-xs tracking-wider ${done ? 'text-mist' : active ? 'text-cyan-200' : 'text-mist/40'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<ModelHealth | null>(null)
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    getModelHealth().then(setHealth).catch(() => setHealth(null))
    getModelInfo().then(setModelInfo).catch(() => setModelInfo(null))
  }, [])

  const handleAnalyze = useCallback(async (raw?: string) => {
    const trimmed = (raw ?? url).trim()
    if (!trimmed) {
      setError('Please enter a website URL.')
      setResult(null)
      return
    }
    setUrl(trimmed)
    setScanning(true)
    setError(null)
    setResult(null)
    setStep(0)

    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1))
    }, 480)
    const animationDone = new Promise((resolve) => setTimeout(resolve, SCAN_STEPS.length * 480))

    try {
      const [realResult] = await Promise.all([predictUrl(trimmed), animationDone])
      await new Promise((r) => setTimeout(r, 250))
      setResult(realResult)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      clearInterval(timer)
      setScanning(false)
    }
  }, [url])

  const stats = health
    ? [
        { value: health.dataset_size ?? 0, suffix: '+', label: 'URL SAMPLES' },
        { value: health.num_features, suffix: '+', label: 'FEATURES' },
        { value: health.models_available.length, suffix: '', label: 'ML MODELS' },
        { value: Math.round((health.metrics?.roc_auc ?? 0) * 1000), suffix: '', label: 'ROC-AUC ×1000' },
      ]
    : null

  const isPhishing = result?.prediction === 'phishing'

  return (
    <main className="relative overflow-x-clip">
      <ScrollProgress />

      {/* ============================================================ HERO */}
      <section className="relative flex min-h-screen flex-col justify-center overflow-hidden px-4 pb-16 pt-28 sm:px-6">
        <div className="bg-cybergrid absolute inset-0" />
        <div className="glow-orb orb-a left-[-120px] top-[-120px] h-[420px] w-[420px]" />
        <div className="glow-orb orb-b right-[-160px] top-[20%] h-[480px] w-[480px]" />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="hero-word chip" style={{ animationDelay: '0ms' }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              AI-POWERED PHISHING INTELLIGENCE
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] tracking-tight text-white sm:text-7xl lg:text-8xl">
              <span className="hero-word block" style={{ animationDelay: '120ms' }}>THE WEB IS FULL</span>
              <span className="hero-word block" style={{ animationDelay: '240ms' }}>OF TRAPS.</span>
              <span className="text-gradient hero-word block" style={{ animationDelay: '420ms' }}>
                WE FIND THEM.
              </span>
            </h1>
            <p className="hero-word mt-6 max-w-xl text-sm leading-relaxed text-mist sm:text-base" style={{ animationDelay: '540ms' }}>
              PhishGuard AI analyzes website characteristics with machine learning to
              identify URLs exhibiting patterns associated with phishing.
            </p>

            {/* hero scanner card */}
            <div className="hero-word relative mt-8 max-w-xl overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0a1120]/80 p-5 backdrop-blur-xl sm:p-6" style={{ animationDelay: '660ms' }}>
              <div className="scan-sweep pointer-events-none absolute left-0 h-24 w-full bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-300">SECURITY ENGINE READY</span>
              </div>
              <p className="mt-3 text-xs text-mist">Paste a URL to begin analysis — it is never visited, only read as text.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500/70" />
                  <input
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); if (error) setError(null) }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="https://example.com"
                    aria-label="Website URL"
                    className="w-full rounded-xl border border-edge bg-[#080e1c]/90 py-3 pl-10 pr-4 font-mono text-sm text-slate-100 outline-none transition-colors placeholder:text-mist/50 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={scanning}
                  className="btn-cyber inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
                >
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                  {scanning ? 'SCANNING' : 'ANALYZE'}
                </button>
              </div>

              {scanning && (
                <div className="mt-5 rounded-xl border border-edge bg-[#080e1c] p-4">
                  <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-cyan-300">SCANNING TARGET</div>
                  <ScanSteps step={step} />
                </div>
              )}
              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <SecurityCore />
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] text-mist/50">SCROLL TO EXPLORE</div>
          <div className="mx-auto mt-2 h-8 w-px animate-pulse bg-gradient-to-b from-cyan-400 to-transparent" />
        </div>
      </section>

      {/* ==================================================== ONE URL STORY */}
      <section className="border-y border-edge/50 bg-[#070d1a] py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <Reveal>
            <div className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">ONE URL.</div>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-3 font-display text-4xl font-bold tracking-tight text-cyan-300 sm:text-6xl">
              {health ? `${health.num_features}+` : '32+'} SIGNALS.
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-3 font-display text-4xl font-bold tracking-tight text-sky-300 sm:text-6xl">
              {health ? `${health.models_available.length}` : '4'} ML MODELS.
            </div>
          </Reveal>
          <Reveal delay={450}>
            <div className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
              ONE SECURITY <span className="text-gradient">ASSESSMENT.</span>
            </div>
          </Reveal>
          <Reveal delay={600}>
            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2 font-mono text-[11px] tracking-widest text-mist">
              <span className="chip">URL</span>
              <ArrowRight className="h-3 w-3 text-cyan-400" />
              <span className="chip">FEATURE EXTRACTION</span>
              <ArrowRight className="h-3 w-3 text-cyan-400" />
              <span className="chip">ML CLASSIFICATION</span>
              <ArrowRight className="h-3 w-3 text-cyan-400" />
              <span className="chip">RISK ASSESSMENT</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================================================== URL ANATOMY */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">EVERY URL TELLS A STORY.</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-3 max-w-2xl text-sm text-mist">
              PhishGuard doesn't just look at the URL. It reads its structure — splitting it
              into protocol, subdomain, domain, path and query, then scoring each part.
            </p>
          </Reveal>

          <div className="glass mt-10 p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-0 font-mono text-sm sm:text-lg">
              {ANATOMY_PARTS.map((a, i) => (
                <Reveal key={a.label} delay={i * 180} className="inline">
                  <span className={`inline-block px-1 py-1.5 ${a.suspicious ? 'text-red-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.35)]' : 'text-slate-200'}`}>
                    {a.part}
                  </span>
                </Reveal>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {ANATOMY_PARTS.map((a, i) => (
                <Reveal key={a.label} delay={i * 180 + 100}>
                  <div className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] tracking-widest ${a.suspicious ? 'border-red-500/40 text-red-300' : 'border-edge text-mist'}`}>
                    {a.label}
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={300}>
              <p className="mt-6 flex items-start gap-2 text-xs text-mist">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                The stacked subdomain and the <span className="text-red-300">/reset</span> keyword are exactly the
                kind of structural signals the model learns to weigh.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ==================================================== FEATURE FLOW */}
      <section className="border-y border-edge/50 bg-[#070d1a] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              ONE URL IN. A VECTOR OF SIGNALS OUT.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-mist">
              The extractor converts a URL string into {health ? health.num_features : 32} numeric features —
              the same ones used to train every model.
            </p>
          </Reveal>

          <div className="relative mt-14">
            <div className="flow-visual mx-auto grid max-w-4xl items-center gap-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="mx-auto w-full max-w-[220px]">
                <div className="rounded-2xl border border-cyan-500/30 bg-[#0a1120]/80 p-4 text-center">
                  <div className="font-mono text-[10px] tracking-widest text-mist">INPUT</div>
                  <div className="mt-2 truncate font-mono text-xs text-cyan-200">example.com/login</div>
                </div>
              </div>
              <div className="hidden text-cyan-400 lg:block"><ArrowRight className="h-5 w-5" /></div>
              <div className="flex flex-wrap justify-center gap-2 lg:max-w-[340px]">
                {FEATURE_CHIPS.map((f, i) => (
                  <span
                    key={f}
                    className="blob-in rounded-full border border-edge bg-[#0a1120]/80 px-3 py-1.5 font-mono text-[10px] tracking-wider text-mist"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    {f}
                  </span>
                ))}
                <span className="blob-in rounded-full border border-cyan-500/30 px-3 py-1.5 font-mono text-[10px] text-cyan-300" style={{ animationDelay: `${FEATURE_CHIPS.length * 90}ms` }}>
                  +{Math.max(0, (health?.num_features ?? 32) - FEATURE_CHIPS.length)} MORE
                </span>
              </div>
              <div className="hidden text-cyan-400 lg:block"><ArrowRight className="h-5 w-5" /></div>
              <div className="mx-auto w-full max-w-[220px]">
                <div className="animate-pulse-glow rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-[#0b1a33] to-[#06101f] p-4 text-center">
                  <div className="font-mono text-[10px] tracking-widest text-mist">ML ENGINE</div>
                  <div className="mt-2 font-display text-sm font-bold text-white">
                    {health?.model_name ?? 'RANDOM FOREST'}
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-cyan-300">→ RISK ASSESSMENT</div>
                </div>
              </div>
            </div>
            <svg className="pointer-events-none absolute inset-0 mx-auto hidden max-w-4xl lg:block" viewBox="0 0 900 120" fill="none" aria-hidden="true">
              <path className="flow-dash" d="M230 60 H320" stroke="#22d3ee" strokeWidth="1.5" />
              <path className="flow-dash" d="M680 60 H780" stroke="#22d3ee" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </section>

      {/* ==================================================== ML MODELS */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">NOT ONE MODEL.</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-3 max-w-2xl text-sm text-mist">
              Four classifiers compete on the same held-out test set. The model doesn't just
              predict — it learns the statistical patterns of phishing URLs from {health?.dataset_size?.toLocaleString() ?? '667,000+'} labelled examples.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(health?.models_available ?? ['Logistic Regression', 'Decision Tree', 'Random Forest', 'XGBoost']).map((name, i) => {
              const m = modelInfo?.models[name]?.metrics
              const best = health?.model_name === name
              return (
                <Reveal key={name} delay={i * 120}>
                  <div className={`glass glass-hover relative p-5 ${best ? 'border-cyan-500/40' : ''}`}>
                    {best && (
                      <span className="absolute right-3 top-3 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold text-cyan-200 ring-1 ring-cyan-500/40">
                        DEPLOYED
                      </span>
                    )}
                    <div className="font-display text-base font-bold text-white">{name}</div>
                    <div className="mt-0.5 text-[10px] text-mist">{MODEL_TAGLINE[name] ?? 'trained classifier'}</div>
                    {m ? (
                      <div className="mt-4 space-y-2">
                        {[
                          ['Accuracy', m.accuracy, '%'],
                          ['Recall', m.recall, '%'],
                          ['F1', m.f1, ''],
                        ].map(([lab, val, suf]) => (
                          <div key={lab as string}>
                            <div className="flex justify-between font-mono text-[9px] text-mist">
                              <span>{lab}</span>
                              <span className="text-slate-200">{((val as number) * 100).toFixed(1)}{suf}</span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-[#15213680]">
                              <div className="h-full rounded-full bg-cyan-400/80 transition-all duration-700" style={{ width: `${(val as number) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                        <div className="pt-1 font-mono text-[9px] text-cyan-300">ROC-AUC {(m.roc_auc * 100).toFixed(1)}%</div>
                      </div>
                    ) : (
                      <div className="mt-4 font-mono text-[10px] text-mist/60">Awaiting evaluation data</div>
                    )}
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ==================================================== EXPLAINABLE AI */}
      <section className="border-y border-edge/50 bg-[#070d1a] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              WE DON'T JUST SAY WHAT.<br />
              <span className="text-gradient">WE SHOW WHY.</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="glass p-6">
                <div className="font-mono text-[10px] tracking-widest text-mist">PREDICTION</div>
                {result ? (
                  <div className={`mt-2 flex items-center gap-2 font-display text-2xl font-bold ${isPhishing ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isPhishing ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                    {isPhishing ? 'POTENTIALLY PHISHING' : 'LOW RISK'}
                  </div>
                ) : (
                  <div className="mt-2 font-display text-2xl font-bold text-mist/60">AWAITING ANALYSIS</div>
                )}
                <div className="mt-5 font-mono text-[10px] tracking-widest text-mist">WHY?</div>
                <div className="mt-3 space-y-2.5">
                  {result ? (
                    result.explanation.length > 0 ? (
                      result.explanation.slice(0, 5).map((item) => (
                        <div key={item.feature} className="flex items-center gap-3 text-sm">
                          <span className="w-40 truncate text-slate-300">{item.feature}</span>
                          <div className="h-1.5 flex-1 rounded-full bg-[#15213680]">
                            <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${Math.min(100, Math.abs(item.value - item.typical_legit) / Math.max(item.typical_legit, 1) * 30)}%` }} />
                          </div>
                          <span className="w-12 text-right font-mono text-xs text-cyan-200">{item.value}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-mist">No features deviated from the legitimate baseline.</p>
                    )
                  ) : (
                    (modelInfo?.feature_importance.slice(0, 5) ?? []).map((f) => (
                      <div key={f.name} className="flex items-center gap-3 text-sm">
                        <span className="w-40 truncate text-slate-300">{f.name}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-[#15213680]">
                          <div className="h-full rounded-full bg-cyan-400/80" style={{ width: `${f.importance * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-cyan-200">{(f.importance * 100).toFixed(1)}</span>
                      </div>
                    ))
                  )}
                </div>
                {!result && (
                  <p className="mt-4 text-[11px] text-mist/70">
                    Showing global feature importances. Analyze a URL above to see a per-URL explanation.
                  </p>
                )}
                <a href="#/insights" className="btn-cyber mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white">
                  EXPLORE EXPLAINABLE AI <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="glass p-6">
                <div className="font-mono text-[10px] tracking-widest text-mist">THREAT DNA</div>
                <div className="mt-2 font-display text-xl font-bold text-white">EVERY URL HAS A THREAT DNA.</div>
                {result ? (
                  <div className="mt-4">
                    <ThreatDnaChart dna={result.threat_dna} />
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-edge bg-[#0a1120]/60 p-10 text-center">
                    <Radar className="h-8 w-8 text-mist" />
                    <p className="text-sm text-mist">Awaiting analysis</p>
                    <p className="max-w-xs text-[11px] text-mist/60">
                      Seven category scores derived from the model's own feature statistics will appear here after a scan.
                    </p>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ==================================================== RISK REVEAL */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              SO... WHAT DOES THE MODEL SEE?
            </h2>
          </Reveal>
          <Reveal delay={150}>
            {result ? (
              <div className="mt-10">
                <div className={`font-display text-8xl font-bold sm:text-9xl ${isPhishing ? 'text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.35)]' : 'text-emerald-400'}`}>
                  {result.risk_score_percent.toFixed(1)}%
                </div>
                <div className="mt-3 font-mono text-sm tracking-[0.3em] text-slate-200">
                  {isPhishing ? 'POTENTIALLY PHISHING' : 'LOW RISK'} · {result.risk_level}
                </div>
                <div className="mx-auto mt-8 flex max-w-md items-center justify-center">
                  <RiskMeter percent={result.risk_score_percent} level={result.risk_level} />
                </div>
                <p className="mx-auto mt-6 max-w-md text-xs text-mist">
                  Real output from <span className="text-cyan-300">{result.model_name}</span>. A model probability
                  estimate, not a guarantee — always verify before entering credentials.
                </p>
              </div>
            ) : (
              <div className="mt-10">
                <div className="font-display text-5xl font-bold text-mist/50 sm:text-6xl">—%</div>
                <p className="mt-4 text-sm text-mist">ANALYZE A URL TO REVEAL ITS RISK.</p>
                <button onClick={() => document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' })} className="btn-cyber mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white">
                  <ShieldAlert className="h-4 w-4" /> ANALYZE A URL
                </button>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ==================================================== TRY IT YOURSELF */}
      <section id="scanner" className="scroll-mt-24 border-t border-edge/50 bg-[#070d1a] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">TRY IT YOURSELF.</h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500/70" />
                <input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (error) setError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Paste a URL to analyze"
                  aria-label="Website URL"
                  className="w-full rounded-xl border border-edge bg-[#080e1c]/90 py-3.5 pl-10 pr-4 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <button onClick={() => handleAnalyze()} disabled={scanning} className="btn-cyber inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                {scanning ? 'SCANNING' : 'ANALYZE URL'}
              </button>
            </div>
            <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-mist/70">Try:</span>
              {SAMPLE_URLS.map((s) => (
                <button key={s} onClick={() => handleAnalyze(s)} className="chip hover:border-cyan-500/50 hover:text-cyan-200">
                  {s}
                </button>
              ))}
            </div>
          </Reveal>

          <div ref={resultRef} className="scroll-mt-24">
            {scanning && (
              <div className="glass mx-auto mt-8 max-w-3xl p-6">
                <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-cyan-300">SCANNING TARGET</div>
                <ScanSteps step={step} />
              </div>
            )}
            {error && (
              <div className="mx-auto mt-6 flex max-w-3xl items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {result && (
              <div className="animate-fade-up mx-auto mt-10 max-w-5xl">
                <div className={`rounded-2xl border p-6 sm:p-8 ${isPhishing ? 'border-red-500/40 bg-gradient-to-br from-red-950/50 to-[#12070b]' : 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-[#07120b]'}`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isPhishing ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {isPhishing ? <ShieldAlert className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-display text-xl font-bold sm:text-2xl ${isPhishing ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isPhishing ? '🔴 POTENTIALLY PHISHING' : '🟢 LOW RISK'}
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-mist">{result.url}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="chip"><span className="font-mono">Model</span> <strong className="text-cyan-300">{result.model_name}</strong></span>
                      <span className="chip"><span className="font-mono">ID</span> <strong className="text-sky-300">{result.analysis_id}</strong></span>
                      <span className="chip"><span className="font-mono">Risk</span> <strong className={isPhishing ? 'text-red-400' : 'text-emerald-400'}>{result.risk_level}</strong></span>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
                    <div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {result.security_analysis.map((card) => (
                          <div key={card.feature} className="glass glass-hover p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-300">{card.feature}</span>
                              <Activity className="h-4 w-4 text-cyan-400" />
                            </div>
                            <p className="mt-2 text-xs text-mist">{card.message}</p>
                            <p className={`mt-2 font-mono text-[10px] uppercase tracking-wider ${card.status === 'safe' ? 'text-emerald-300' : card.status === 'warning' ? 'text-amber-300' : 'text-red-300'}`}>
                              {card.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="glass flex flex-col items-center justify-center gap-2 p-6">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-mist">Risk Score</span>
                      <RiskMeter percent={result.risk_score_percent} level={result.risk_level} />
                      <p className="max-w-[220px] text-center text-xs text-mist/80">{result.risk_description}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-display text-base font-semibold text-slate-100">URL Anatomy</h3>
                  <div className="glass mt-3 p-5"><UrlAnatomyView anatomy={result.url_anatomy} /></div>
                </div>
                <div className="mt-8">
                  <h3 className="font-display text-base font-semibold text-slate-100">Threat DNA</h3>
                  <div className="glass mt-3 p-5"><ThreatDnaChart dna={result.threat_dna} /></div>
                </div>
                <div className="mt-8"><WhatIf result={result} /></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ==================================================== FINAL CTA */}
      <section className="relative overflow-hidden py-28">
        <div className="bg-cybergrid absolute inset-0 opacity-60" />
        <div className="glow-orb orb-c left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
              THE NEXT URL YOU CLICK<br />COULD BE A TRAP.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 font-display text-xl text-cyan-200 sm:text-2xl">KNOW BEFORE YOU CLICK.</p>
          </Reveal>
          <Reveal delay={350}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' })} className="btn-cyber inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-bold text-white">
                <ShieldAlert className="h-4 w-4" /> ANALYZE A URL
              </button>
              <a href="#/insights" className="inline-flex items-center gap-2 rounded-xl border border-edge px-8 py-4 text-sm font-bold text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200">
                EXPLORE THE MODEL <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={500}>
            <div className="mx-auto mt-14 max-w-3xl border-t border-edge/60 pt-8">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {stats ? (
                  <>
                    <Counter value={health?.dataset_size ?? 0} suffix="+" label="URL SAMPLES" />
                    <Counter value={health?.num_features ?? 0} suffix="+" label="FEATURES" />
                    <Counter value={health?.models_available.length ?? 0} suffix="" label="ML MODELS" />
                    <Counter value={Math.round((health?.metrics?.roc_auc ?? 0) * 1000)} suffix="" label="ROC-AUC ×1000" />
                  </>
                ) : (
                  <>
                    <Counter value={667} suffix="K+" label="URL SAMPLES" />
                    <Counter value={32} suffix="+" label="FEATURES" />
                    <Counter value={4} suffix="" label="ML MODELS" />
                    <Counter value={976} suffix="" label="ROC-AUC ×1000" />
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[9px] tracking-widest text-mist/70">
                <span className="chip">PYTHON</span>
                <span className="chip">SCIKIT-LEARN</span>
                <span className="chip">XGBOOST</span>
                <span className="chip">FASTAPI</span>
                <span className="chip">REACT</span>
                <span className="chip">TYPESCRIPT</span>
                <span className="chip">TAILWIND</span>
                <span className="chip">SQLITE</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
