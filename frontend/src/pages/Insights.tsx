import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Brain,
  Database,
  GitCommitHorizontal,
  LayoutDashboard,
  Scale,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import StatCard from '../components/StatCard'
import { getModelInfo } from '../lib/api'
import type { ModelInfo } from '../lib/types'

const MODEL_SHORT = {
  'Logistic Regression': 'Logistic Reg.',
  'Decision Tree': 'Decision Tree',
  'Random Forest': 'Random Forest',
  XGBoost: 'XGBoost',
} as const

const MODEL_COLORS = ['#38bdf8', '#a78bfa', '#22d3ee', '#f472b6']

function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const labels = ['Legitimate', 'Phishing']
  const max = Math.max(...matrix.flat())
  const cells = matrix.map((row, i) =>
    row.map((v, j) => (
      <div
        key={`${i}${j}`}
        className="flex flex-col items-center justify-center rounded-lg p-4 sm:p-6"
        style={{
          background: `rgba(34,211,238,${0.08 + (v / max) * 0.85})`,
          border: '1px solid rgba(56,189,248,0.25)',
        }}
      >
        <span className="font-display text-xl font-bold text-white sm:text-2xl">{v.toLocaleString()}</span>
        <span className="mt-1 text-center text-[10px] text-mist">
          {labels[i]} → {labels[j]}
        </span>
      </div>
    )),
  )

  return (
    <div>
      <div className="mb-2 grid-cols-2 gap-3">
        <div className="grid gap-3 sm:grid-cols-2">{cells.flat()}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-mist">
        <span className="chip"><span className="text-emerald-400">Top-left</span> True negatives</span>
        <span className="chip"><span className="text-red-400">Top-right</span> False positives</span>
        <span className="chip"><span className="text-emerald-400">Bottom-left</span> False negatives</span>
        <span className="chip"><span className="text-red-400">Bottom-right</span> True positives</span>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass animate-fade-up p-5">
      <h3 className="font-display text-sm font-semibold text-slate-100">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-mist">{subtitle}</p>}
      <div className="mt-4 h-64 w-full sm:h-72">{children}</div>
    </div>
  )
}

export default function Insights() {
  const [info, setInfo] = useState<ModelInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getModelInfo()
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load model info'))
  }, [])

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <div className="glass mx-auto max-w-md p-8">
          <Brain className="mx-auto h-10 w-10 text-cyan-300" />
          <h1 className="mt-4 font-display text-lg text-white">Model not ready</h1>
          <p className="mt-2 text-sm text-mist">{error}</p>
          <p className="mt-2 font-mono text-xs text-cyan-300">python -m ml.train</p>
        </div>
      </main>
    )
  }

  if (!info) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6">
        <div className="animate-spin-slow mx-auto h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent" />
      </main>
    )
  }

  const modelNames = Object.keys(info.models)
  const comparisonData = modelNames.map((name) => ({
    name: MODEL_SHORT[name as keyof typeof MODEL_SHORT] ?? name,
    Accuracy: Number((info.models[name].metrics.accuracy * 100).toFixed(1)),
    Precision: Number((info.models[name].metrics.precision * 100).toFixed(1)),
    Recall: Number((info.models[name].metrics.recall * 100).toFixed(1)),
    F1: Number((info.models[name].metrics.f1 * 100).toFixed(1)),
  }))

  const rocData = modelNames.map((name) => {
    const r = info.models[name].roc
    return {
      name: MODEL_SHORT[name as keyof typeof MODEL_SHORT] ?? name,
      auc: (r.auc * 100).toFixed(1),
      fpr: r.fpr,
      tpr: r.tpr,
      color: MODEL_COLORS[modelNames.indexOf(name)],
      isBest: name === info.best_model,
    }
  })

  const rocChartData: Record<string, string | number>[] = []
  const fpr = info.models[modelNames[0]].roc.fpr
  for (let i = 0; i < fpr.length; i++) {
    const row: Record<string, number | string> = { fpr: (fpr[i] * 100).toFixed(1) }
    rocData.forEach((m) => {
      row[m.name] = m.tpr[i] * 100
    })
    rocChartData.push(row)
  }

  const topFeatures = [...info.feature_importance]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15)
    .reverse()
    .map((f) => ({ name: f.name, importance: f.importance }))

  const d = info.dataset
  const bm = info.best_metrics

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Model Insights</h1>
          <p className="mt-1 text-sm text-mist">
            Real evaluation numbers from the trained pipeline — nothing on this page is hardcoded.
          </p>
        </div>
        <div className="chip">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          Best model: <strong className="text-cyan-300">{info.best_model}</strong>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Database} label="Dataset size" value={d.rows_after_clean.toLocaleString()} sub={`↑ ${d.raw_rows_total.toLocaleString()} raw records`} />
        <StatCard icon={GitCommitHorizontal} label="Legitimate" value={d.legitimate_count.toLocaleString()} accent="text-emerald-400" sub={`${((d.legitimate_count / d.rows_after_clean) * 100).toFixed(0)}% of samples`} />
        <StatCard icon={Target} label="Phishing" value={d.phishing_count.toLocaleString()} accent="text-red-400" sub={`${((d.phishing_count / d.rows_after_clean) * 100).toFixed(0)}% of samples`} />
        <StatCard icon={Scale} label="Train / Test split" value={`${(info.train_size / 1000).toFixed(0)}k / ${(info.test_size / 1000).toFixed(0)}k`} sub="80% / 20% · stratified · seed 42" />
      </section>

      {bm && (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard icon={BarChart3} label="Accuracy" value={`${(bm.accuracy * 100).toFixed(1)}%`} accent="text-cyan-300" />
          <StatCard icon={Target} label="Precision" value={`${(bm.precision * 100).toFixed(1)}%`} accent="text-sky-300" />
          <StatCard icon={Activity} label="Recall" value={`${(bm.recall * 100).toFixed(1)}%`} accent="text-violet-300" />
          <StatCard icon={TrendingUp} label="F1-score" value={`${(bm.f1 * 100).toFixed(1)}%`} accent="text-emerald-400" />
          <StatCard icon={LayoutDashboard} label="ROC-AUC" value={`${(bm.roc_auc * 100).toFixed(1)}%`} accent="text-fuchsia-300" />
        </section>
      )}

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Model Accuracy Comparison" subtitle="Test-set accuracy across the 4 candidate classifiers">
          <ResponsiveContainer>
            <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2740" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0d1526', border: '1px solid #1d2a44', borderRadius: 10 }}
                labelStyle={{ color: '#e5edf8' }}
              />
              <Bar dataKey="Accuracy" radius={[6, 6, 0, 0]}>
                {comparisonData.map((entry, i) => (
                  <Cell key={entry.name} fill={MODEL_COLORS[i]} fillOpacity={entry.name === MODEL_SHORT[info.best_model as keyof typeof MODEL_SHORT] ? 1 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Precision / Recall / F1 Comparison" subtitle="Why accuracy alone is insufficient">
          <ResponsiveContainer>
            <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2740" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0d1526', border: '1px solid #1d2a44', borderRadius: 10 }}
                labelStyle={{ color: '#e5edf8' }}
                cursor={{ fill: 'rgba(34,211,238,0.06)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Precision" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Recall" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="F1" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ROC Curve — all models" subtitle={`AUC scores shown in the legend (${info.best_model} highlighted)`}>
          <ResponsiveContainer>
            <LineChart data={rocChartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2740" />
              <XAxis dataKey="fpr" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'False Positive Rate (%)', fill: '#64748b', fontSize: 10, dy: 8 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} label={{ value: 'True Positive Rate (%)', angle: -90, fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#0d1526', border: '1px solid #1d2a44', borderRadius: 10 }}
                labelStyle={{ color: '#e5edf8' }}
              />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              {rocData.map((m) => (
                <Line
                  key={m.name}
                  type="monotone"
                  dataKey={m.name}
                  stroke={m.color}
                  strokeWidth={m.isBest ? 2.8 : 1.5}
                  strokeDasharray={m.isBest ? undefined : '6 4'}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Confusion Matrix" subtitle={`${info.best_model} on the held-out test set (${info.test_size.toLocaleString()} URLs)`}>
          <div className="mt-2 h-full overflow-x-auto">
            <ConfusionMatrix matrix={info.models[info.best_model].confusion_matrix} />
          </div>
        </ChartCard>
      </section>

      <section className="mt-8">
        <ChartCard title="Feature Importance" subtitle="Top 15 engineered URL features for the Random Forest classifier">
          <ResponsiveContainer>
            <BarChart data={topFeatures} layout="vertical" margin={{ top: 0, right: 24, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2740" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0d1526', border: '1px solid #1d2a44', borderRadius: 10 }}
                labelStyle={{ color: '#e5edf8' }}
                cursor={{ fill: 'rgba(34,211,238,0.06)' }}
              />
              <Bar dataKey="importance" fill="#22d3ee" radius={[0, 5, 5, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </main>
  )
}