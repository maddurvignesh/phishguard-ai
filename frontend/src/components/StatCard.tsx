import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  value: string
  accent?: string
  sub?: string
}

export default function StatCard({ icon: Icon, label, value, accent = 'text-cyan-300', sub }: Props) {
  return (
    <div className="glass glass-hover animate-fade-up flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-mist">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className={`font-display text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-mist/80">{sub}</div>}
    </div>
  )
}