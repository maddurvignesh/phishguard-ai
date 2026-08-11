import { AlertTriangle, Info } from 'lucide-react'
import type { UrlAnatomy } from '../lib/types'

interface Props {
  anatomy: UrlAnatomy
}

const NAME_LABELS: Record<string, string> = {
  protocol: 'Protocol',
  subdomain: 'Subdomain',
  domain: 'Domain',
  port: 'Port',
  path: 'Path',
  query: 'Query',
  fragment: 'Fragment',
}

export default function UrlAnatomyView({ anatomy }: Props) {
  if (!anatomy?.components?.length) return null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        {anatomy.components.map((comp, i) => (
          <div key={`${comp.name}-${i}`} className="group relative">
            <span
              className={`inline-block cursor-help rounded-lg border px-2.5 py-1.5 transition-colors ${
                comp.suspicious
                  ? 'border-red-500/50 bg-red-500/10 text-red-300'
                  : 'border-edge bg-[#0a1120]/70 text-slate-200'
              }`}
              title={comp.note}
            >
              {comp.suspicious && <AlertTriangle className="mr-1 inline h-3 w-3 text-red-400" />}
              {comp.value.length > 46 ? comp.value.slice(0, 43) + '…' : comp.value}
            </span>
            <span className="pointer-events-none absolute -bottom-5 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-edge bg-[#0d1526] px-2 py-1 font-sans text-[10px] text-mist group-hover:block">
              {NAME_LABELS[comp.name]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {anatomy.components.map((comp, i) => (
          <div
            key={`${comp.name}-note-${i}`}
            className={`glass p-4 ${comp.suspicious ? 'border-red-500/40' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {NAME_LABELS[comp.name]}
              </span>
              {comp.suspicious ? (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/30">
                  Suspicious
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                  Normal
                </span>
              )}
            </div>
            <p className="mt-2 break-all font-mono text-xs text-cyan-200">{comp.value}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-mist/80">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
              {comp.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
