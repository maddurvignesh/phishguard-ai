import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FlaskConical, LayoutDashboard, Menu, Radar, ShieldAlert, TerminalSquare, X } from 'lucide-react'

const links = [
  { to: '/', label: 'Scan', icon: Radar },
  { to: '/', label: 'Threat DNA', icon: Radar, section: true },
  { to: '/playground', label: 'Model Playground', icon: FlaskConical },
  { to: '/insights', label: 'Model Lab', icon: LayoutDashboard },
  { to: '/dashboard', label: 'Analytics', icon: TerminalSquare },
  { to: '/lab', label: 'Phishing Lab', icon: ShieldAlert },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function goScan() {
    setOpen(false)
    if (window.location.hash !== '#/') {
      navigate('/')
    }
    setTimeout(() => {
      document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' })
    }, 60)
  }

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-edge/70 bg-[#05080f]/85 shadow-lg shadow-black/20 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="animate-pulse-glow flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-700 tracking-wide text-white group-hover:text-cyan-200">
              PHISHGUARD <span className="text-gradient">AI</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-mist">
              Threat Intelligence Engine
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1.5 lg:flex sm:gap-3">
          {links.map(({ to, label, icon: Icon, section }) =>
            section ? (
              <button
                key={label}
                onClick={goScan}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-white/5 hover:text-slate-200 sm:px-3.5 sm:text-sm"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium sm:px-3.5 sm:text-sm transition-colors ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'text-mist hover:bg-white/5 hover:text-slate-200'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={goScan}
            className="hidden rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-blue-500 hover:shadow-cyan-400/40 lg:inline-flex"
          >
            ANALYZE URL
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-slate-200 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-edge/60 bg-[#05080f]/95 px-4 py-3 lg:hidden">
          <div className="grid gap-1">
            {links.map(({ to, label, icon: Icon, section }) =>
              section ? (
                <button
                  key={label}
                  onClick={goScan}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-cyan-500/15 text-cyan-300' : 'text-mist hover:bg-white/5 hover:text-slate-200'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              )
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
