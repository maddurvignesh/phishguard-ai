import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import type { ThreatDna } from '../lib/types'

interface Props {
  dna: ThreatDna
}

const CATEGORY_COLORS: Record<string, string> = {
  'URL Complexity': '#38bdf8',
  'Domain Risk': '#a78bfa',
  'Subdomain Risk': '#f472b6',
  'Keyword Suspicion': '#fbbf24',
  'Security Indicators': '#34d399',
  'Special Character Patterns': '#22d3ee',
  'Structural Anomalies': '#fb7185',
}

export default function ThreatDnaChart({ dna }: Props) {
  const data = Object.entries(dna.categories).map(([name, value]) => ({
    category: name,
    score: value,
    fill: CATEGORY_COLORS[name] ?? '#22d3ee',
  }))

  const max = dna.max || 100

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#1d2a44" />
            <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, max]} tick={{ fill: '#475569', fontSize: 9 }} />
            <Radar
              dataKey="score"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.28}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center gap-2">
        {data.map((d) => (
          <div key={d.category} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.fill }} />
            <span className="w-44 truncate text-slate-300">{d.category}</span>
            <div className="h-1.5 flex-1 rounded-full bg-[#15213680]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, d.score)}%`, background: d.fill }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs text-cyan-200">{d.score.toFixed(0)}</span>
          </div>
        ))}
        <p className="mt-3 text-[11px] leading-relaxed text-mist/70">
          Threat DNA scores are heuristic summaries derived from the model's own feature
          statistics and importances (0 = typical legitimate profile, {max} = extreme
          phishing-like profile). Not official threat-intelligence scores.
        </p>
      </div>
    </div>
  )
}
