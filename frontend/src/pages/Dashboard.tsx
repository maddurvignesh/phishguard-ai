import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, History, ShieldCheck, ShieldAlert, Siren, Trash2, Activity } from 'lucide-react'
import StatCard from '../components/StatCard'
import { clearHistory, getHistory, getStats } from '../lib/api'
import type { HistoryItem, RiskLevel, Stats } from '../lib/types'

const LEVEL_BADGE: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  HIGH: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  CRITICAL: 'bg-red-500/15 text-red-300 ring-red-500/30',
}

function RiskBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[#15213680]">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          percent >= 60 ? 'bg-red-500' : percent >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
        }`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const [s, h] = await Promise.all([getStats(), getHistory(20)])
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Security Dashboard</h1>
          <p className="mt-1 text-sm text-mist">Live statistics from every analysis performed in this installation.</p>
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
          <StatCard icon={Siren} label="Avg risk score" value={`${stats.average_risk_percent.toFixed(1)}%`} accent={stats.average_risk_percent > 50 ? 'text-orange-300' : 'text-cyan-300'} sub="rolling average" />
        </section>
      )}

      {history.length > 0 ? (
        <section className="glass mt-8 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-edge px-5 py-4">
            <History className="h-4 w-4 text-cyan-300" />
            <h2 className="font-display text-sm font-semibold text-slate-100">Recent Analyses</h2>
            <span className="ml-auto font-mono text-[10px] text-mist">latest first</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-thin w-full text-left text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-[10px] uppercase tracking-wider text-mist">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">URL</th>
                  <th className="px-5 py-3 font-medium">Prediction</th>
                  <th className="px-5 py-3 font-medium">Risk Score</th>
                  <th className="px-5 py-3 font-medium">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, i) => (
                  <tr key={`${item.created_at}-${i}`} className="border-b border-edge/40">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-mist">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </td>
                    <td className="max-w-[300px] truncate px-5 py-3 font-mono text-xs text-slate-300">
                      {item.url}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${item.prediction === 'phishing' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {item.prediction === 'phishing' ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {item.prediction === 'phishing' ? 'PHISHING' : 'LEGITIMATE'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="w-28">
                        <RiskBar percent={item.risk_score * 100} />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${LEVEL_BADGE[item.risk_level]}`}>
                        {item.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        !loading && (
          <div className="glass mt-8 flex flex-col items-center gap-3 p-10 text-center">
            <Clock className="h-8 w-8 text-mist" />
            <p className="text-sm text-mist">No analyses yet. Run a URL through the detector and it will appear here.</p>
          </div>
        )
      )}

      {loading && (
        <div className="mt-16 animate-spin-slow mx-auto h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent" />
      )}
      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </main>
  )
}