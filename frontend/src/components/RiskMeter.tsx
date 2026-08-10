import { useEffect, useState } from 'react'
import type { RiskLevel } from '../lib/types'

interface Props {
  percent: number
  level: RiskLevel
}

const LEVEL_COLORS: Record<RiskLevel, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#fb923c',
  CRITICAL: '#ef4444',
}

// Semicircular animated risk gauge built with SVG (no chart lib needed).
export default function RiskMeter({ percent, level }: Props) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setP(percent), 80)
    return () => clearTimeout(t)
  }, [percent])

  const clamped = Math.min(100, Math.max(0, p))
  const r = 74
  const cx = 100
  const cy = 100
  const circumference = Math.PI * r
  const filled = (clamped / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width="210" height="130" viewBox="0 0 200 130" className="overflow-visible">
        <defs>
          <linearGradient id="meterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#1b2740"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#meterGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#e5edf8" fontSize="30" fontWeight="700" fontFamily="Space Grotesk, sans-serif">
          {clamped.toFixed(0)}
          <tspan fontSize="16" fill="#94a3b8">%</tspan>
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill={LEVEL_COLORS[level]} fontSize="12" fontWeight="700" letterSpacing="2" fontFamily="JetBrains Mono, monospace">
          {level} RISK
        </text>
      </svg>
    </div>
  )
}