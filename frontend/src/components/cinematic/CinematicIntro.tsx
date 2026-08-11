import { Component } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import BrandMark from './BrandMark'

type Phase = 'boot' | 'target' | 'brand' | 'exit' | 'done'

const RANK: Record<Phase, number> = {
  boot: 0,
  target: 1,
  brand: 2,
  exit: 3,
  done: 4,
}

const PHASES: { at: number; phase: Phase }[] = [
  { at: 0, phase: 'boot' },
  { at: 900, phase: 'target' },
  { at: 2700, phase: 'brand' },
  { at: 4300, phase: 'exit' },
  { at: 4800, phase: 'done' },
]

const BOOT_TEXT = 'INITIALIZING SECURITY ENGINE'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function useTypewriter(text: string, active: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    setN(0)
    let i = 0
    const iv = setInterval(() => {
      i++
      setN(i)
      if (i >= text.length) clearInterval(iv)
    }, 22)
    return () => clearInterval(iv)
  }, [active, text])
  return text.slice(0, n)
}

class IntroBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

interface Props {
  onComplete: () => void
}

export default function CinematicIntro({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('boot')
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const doneRef = useRef(false)
  const reduced = usePrefersReducedMotion()
  const bootText = useTypewriter(BOOT_TEXT, phase === 'boot')

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(finish, 800)
      return () => clearTimeout(t)
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const el = t - t0
      let cur: Phase = 'boot'
      for (const p of PHASES) {
        if (el >= p.at) cur = p.phase
      }
      setPhase(cur)
      if (cur === 'done') {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const safety = setTimeout(finish, 6800)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
  }, [reduced, finish])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  if (reduced) {
    return (
      <div className="ci-overlay">
        <div className="ci-layer" data-current>
          <div className="ci-brand">
            <BrandMark className="ci-brandmark" />
            <div className="ci-brand-name">PHISHGUARD AI</div>
          </div>
        </div>
      </div>
    )
  }

  const at = (p: Phase) => RANK[phase] >= RANK[p]
  const isBoot = phase === 'boot'
  const isTarget = phase === 'target'
  const isBrand = phase === 'brand' || phase === 'exit'
  const exiting = phase === 'exit'

  const vars = {
    '--ci-mx': `${((mouse.x - 0.5) * 2).toFixed(3)}`,
    '--ci-my': `${((mouse.y - 0.5) * 2).toFixed(3)}`,
  } as CSSProperties

  return (
    <div className="ci-overlay" data-exit={exiting || undefined} style={vars}>
      <IntroBoundary onError={finish}>
        {/* ---- 0.00-0.90 SYSTEM BOOT ---- */}
        <div className="ci-layer" data-current={isBoot || undefined}>
          <div className="ci-parallax-sm">
            <div className="ci-boot-dot" />
            <div className="ci-boot-text">
              <span className="ci-boot-caret">&gt; {bootText}</span>
            </div>
          </div>
          <div className="ci-boot-scan" />
        </div>

        {/* ---- 0.90-2.70 TARGET DETECTED ---- */}
        {at('target') && (
          <div className="ci-layer" data-current={isTarget || undefined}>
            <div>
              <div className="ci-url-wrap">
                <div className="ci-url-scanline" />
                <div className="ci-url">
                  <span>https://</span>
                  <span className="ci-url-sub">login-verify</span>
                  <span>example.com</span>
                </div>
              </div>
              <div className="ci-anomaly">&#9888; ANOMALY DETECTED</div>
            </div>
          </div>
        )}

        {/* ---- 2.70-4.30 PHISHGUARD REVEAL + TRANSITION ---- */}
        {at('brand') && (
          <div className="ci-layer" data-current={isBrand || undefined}>
            <div className="ci-brand">
              <div className="ci-brand-scale">
                <BrandMark className="ci-brandmark" />
                <div className="ci-brand-name">PHISHGUARD AI</div>
                <div className="ci-brand-tag">Detect phishing before it detects you.</div>
              </div>
            </div>
          </div>
        )}

        <div className="ci-exit-glow" data-on={exiting || undefined} />
      </IntroBoundary>

      <button type="button" className="ci-skip" onClick={finish} aria-label="Skip intro">
        SKIP INTRO &#8594;
      </button>
    </div>
  )
}
