import { useEffect, useRef, useState } from 'react'

const NODES = [
  { label: 'URL', angle: -90, duration: 26, color: '#7dd3fc' },
  { label: 'FEATURES', angle: -18, duration: 32, color: '#22d3ee' },
  { label: 'MODEL', angle: 54, duration: 38, color: '#38bdf8' },
  { label: 'RISK', angle: 126, duration: 44, color: '#60a5fa' },
  { label: 'EXPLANATION', angle: 198, duration: 29, color: '#a5f3fc' },
]

export default function SecurityCore() {
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [glow, setGlow] = useState(false)
  const frame = useRef(0)

  useEffect(() => {
    return () => cancelAnimationFrame(frame.current)
  }, [])

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / rect.width
    const dy = (e.clientY - cy) / rect.height
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      setParallax({ x: dx * 12, y: dy * 12 })
      setGlow(true)
    })
  }

  return (
    <div
      className="relative mx-auto h-[360px] w-[360px] select-none sm:h-[420px] sm:w-[420px]"
      onMouseMove={onMove}
      onMouseLeave={() => {
        setParallax({ x: 0, y: 0 })
        setGlow(false)
      }}
      aria-hidden="true"
    >
      {/* halo rings */}
      <div className="absolute inset-6 rounded-full border border-cyan-500/15" />
      <div className="absolute inset-16 rounded-full border border-cyan-500/10" />
      <div className="absolute inset-24 rounded-full border border-dashed border-cyan-500/20" />

      {/* center core */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `translate(${parallax.x * -1.5}px, ${parallax.y * -1.5}px)` }}
      >
        <div className={`animate-pulse-glow flex h-40 w-40 flex-col items-center justify-center rounded-full border border-cyan-400/40 bg-gradient-to-br from-[#0b1a33] to-[#06101f] text-center sm:h-44 sm:w-44 ${glow ? 'brightness-125' : ''}`}>
          <div className="font-display text-sm font-bold tracking-[0.25em] text-white">PHISHGUARD</div>
          <div className="font-mono text-[10px] tracking-[0.35em] text-cyan-300">AI ENGINE</div>
        </div>
      </div>

      {/* orbiting nodes */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${parallax.x}px, ${parallax.y}px)` }}
      >
        {NODES.map((n) => (
          <div
            key={n.label}
            className="orbit absolute inset-0"
            style={{ animationDuration: `${n.duration}s`, animationDelay: `${(n.angle / 360) * -1 * n.duration}s` }}
          >
            <div
              className="orbit-node absolute left-1/2 top-1/2"
              style={{ transform: `translate(-50%, -50%) translateY(-${n.angle >= 90 ? 150 : 162}px)` }}
            >
              <div
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
                style={{ borderColor: `${n.color}55`, color: n.color, background: 'rgba(6,16,31,0.7)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.color }} />
                {n.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
