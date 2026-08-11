import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  History,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import { clearHistory, deleteAnalysis, getHistory, getStats } from '../lib/api'
import type { HistoryItem, RiskLevel, Stats } from '../lib/types'

const LEVEL_BADGE: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  HIGH: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  CRITICAL: 'bg-red-500/15 text-red-300 ring-red-500/30',
}

function RiskBar({ percent }: { percent: number }) {
  const p = Math.min(100, percent)
  return (
    <div className="h-1.5 w-full rounded-full bg-[#15213680]">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          p >= 80 ? 'bg-red-500' : p >= 60 ? 'bg-orange-400' : p >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
        }`}
        style={{ width: `${p}%` }}
      />
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')

  async function refresh() {
    try {
      const [s, h] = await Promise.all([getStats(), getHistory(100, q, filter)])
      setStats(s)
      setHistory(h.results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleClear() {
    if (!confirm('Clear all locally stored analysis history?')) return
    try {
      await clearHistory()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear history')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAnalysis(id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete record')
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-mist">Live statistics and history from every analysis performed in this installation.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="chip text-mist transition-colors hover:border-red-500/50 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </button>
        )}
      </header>

      {!loading && stats && (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Activity} label="Total analyzed" value={stats.total_analyzed.toLocaleString()} sub="URLs processed" />
          <StatCard icon={ShieldAlert} label="Phishing detected" value={stats.phishing_detected.toLocaleString()} accent="text-red-400" sub={`${stats.total_analyzed ? ((stats.phishing_detected / stats.total_analyzed) * 100).toFixed(1) : 0}% flag rate`} />
          <StatCard icon={ShieldCheck} label="Legitimate" value={stats.legitimate_detected.toLocaleString()} accent="text-emerald-400" sub="looked safe" />
          <StatCard icon={Siren} label="High / critical risk" value={stats.high_risk_analyses.toLocaleString()} accent="text-orange-300" sub="flagged analyses" />
        </section>
      )}

      <section className="glass mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-edge px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-300" />
            <h2 className="font-display text-sm font-semibold text-slate-100">Analysis History</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && refresh()}
                placeholder="Search URL…"
                aria-label="Search analysis history"
                className="w-48 rounded-lg border border-edge bg-[#0a1120]/80 py-1.5 pl-8 pr-3 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter by prediction"
              className="rounded-lg border border-edge bg-[#0a1120]/80 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/60"
            >
              <option value="">All predictions</option>
              <option value="phishing">Phishing only</option>
              <option value="legitimate">Legitimate only</option>
            </select>
            <button onClick={refresh} className="chip text-mist hover:text-cyan-200">Apply</button>
          </div>
        </div>

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-thin w-full text-left text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-[10px] uppercase tracking-wider text-mist">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">URL</th>
                  <th className="px-5 py-3 font-medium">Prediction</th>
                  <th className="px-5 py-3 font-medium">Risk Score</th>
                  <th className="px-5 py-3 font-medium">Risk Level</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {history.map((item, i) => (
                  <tr key={`${item.analysis_id || item.created_at}-${i}`} className="border-b border-edge/40">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-mist">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-[260px] truncate px-5 py-3 font-mono text-xs text-slate-300" title={item.url}>
                      {item.url}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${item.prediction === 'phishing' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {item.prediction === 'phishing' ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {item.prediction === 'phishing' ? 'PHISHING' : 'LEGITIMATE'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="w-24">
                        <RiskBar percent={item.risk_score * 100} />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${LEVEL_BADGE[item.risk_level]}`}>
                        {item.risk_level}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[10px] text-mist">{item.model || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[10px] text-sky-300">{item.analysis_id || '—'}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDelete(item.analysis_id)}
                        aria-label="Delete this analysis"
                        className="rounded p-1 text-mist/60 transition-colors hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !loading && (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Clock className="h-8 w-8 text-mist" />
              <p className="text-sm text-mist">
                {q || filter ? 'No analyses match your search.' : 'No analyses yet. Run a URL through the detector and it will appear here.'}
              </p>
            </div>
          )
        )}
      </section>

      {loading && (
        <div className="animate-spin-slow mx-auto mt-16 h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent" />
      )}
      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </main>
  )
}
