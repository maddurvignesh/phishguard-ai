import { useEffect, useState } from 'react'

const STOPS = ['DISCOVER', 'ANALYZE', 'UNDERSTAND', 'ASSESS']

export default function ScrollProgress() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const height = document.body.scrollHeight - window.innerHeight
      const p = height > 0 ? (window.scrollY / height) * 100 : 0
      setActive(Math.min(STOPS.length - 1, Math.floor((p / 100) * STOPS.length)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-5 lg:flex" aria-hidden="true">
      {STOPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`font-mono text-[9px] tracking-[0.25em] transition-all ${
              i === active ? 'text-cyan-300 opacity-100' : 'text-mist/40 opacity-60'
            }`}
            style={{ writingMode: 'vertical-rl' }}
          >
            {s}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full transition-all ${
              i === active ? 'scale-125 bg-cyan-400' : 'bg-[#1d2a44]'
            }`}
          />
        </div>
      ))}
    </div>
  )
}
