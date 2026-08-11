import { useState } from 'react'
import { Check, Copy, Loader2, Play, TerminalSquare } from 'lucide-react'
import { predictUrl } from '../lib/api'

const ENDPOINT = 'POST /api/v1/predict'

export default function ApiLab() {
  const [url, setUrl] = useState('https://example.com')
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  async function tryApi() {
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      const r = await predictUrl(url.trim())
      const compact = {
        prediction: r.prediction,
        risk_score: r.risk_score,
        risk_level: r.risk_level,
        model_name: r.model_name,
        analysis_id: r.analysis_id,
        risk_score_percent: r.risk_score_percent,
        features: r.features,
      }
      setResponse(JSON.stringify(compact, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const requestJson = JSON.stringify({ url: url.trim() || 'https://example.com' }, null, 2)
  const curlCmd = `curl -X POST http://127.0.0.1:8000/api/v1/predict \\\n  -H "Content-Type: application/json" \\\n  -d '${requestJson.replace(/\n/g, ' ')}'`

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">API Lab</h1>
        <p className="mt-1 text-sm text-mist">
          The same endpoint the app uses. Try it live, copy the request or the response.
        </p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Request */}
        <div className="glass p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono text-sm font-semibold text-cyan-200">
              <TerminalSquare className="h-4 w-4" /> {ENDPOINT}
            </h2>
            <button
              onClick={() => copy(requestJson, 'req')}
              className="chip text-mist hover:text-cyan-200"
            >
              {copied === 'req' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied === 'req' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              aria-label="URL to test"
              className="flex-1 rounded-lg border border-edge bg-[#0a1120]/80 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-500/60"
            />
            <button onClick={tryApi} disabled={loading} className="btn-cyber inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Try
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-edge bg-[#080e1c] p-4 font-mono text-xs text-cyan-100">
            {requestJson}
          </pre>
          <button onClick={() => copy(curlCmd, 'curl')} className="chip mt-3 text-mist hover:text-cyan-200">
            {copied === 'curl' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied === 'curl' ? 'Copied' : 'Copy curl command'}
          </button>
        </div>

        {/* Response */}
        <div className="glass p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-slate-200">200 · OK — Response</h2>
            {response && (
              <button onClick={() => copy(response, 'res')} className="chip text-mist hover:text-cyan-200">
                {copied === 'res' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied === 'res' ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          ) : response ? (
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-edge bg-[#080e1c] p-4 font-mono text-xs text-emerald-200">
              {response}
            </pre>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-edge bg-[#080e1c] p-10 text-center">
              <TerminalSquare className="h-8 w-8 text-mist" />
              <p className="text-xs text-mist">Press "Try" to run a live prediction.</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass mt-5 p-5 text-xs leading-relaxed text-mist">
        <strong className="text-slate-200">Schema:</strong> request body is <code className="font-mono text-cyan-200">{'{ "url": "https://example.com" }'}</code>.
        The response always contains <code className="font-mono text-cyan-200">prediction</code>, <code className="font-mono text-cyan-200">risk_score</code>,
        <code className="font-mono text-cyan-200">risk_level</code> and <code className="font-mono text-cyan-200">features</code>. The full
        interactive documentation lives at <code className="font-mono text-cyan-200">http://127.0.0.1:8000/docs</code>.
      </div>
    </main>
  )
}
