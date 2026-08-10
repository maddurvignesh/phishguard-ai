import { Link, NavLink } from 'react-router-dom'
import { LayoutDashboard, Radar, ShieldAlert } from 'lucide-react'

const links = [
  { to: '/', label: 'Detector', icon: Radar },
  { to: '/insights', label: 'Model Insights', icon: LayoutDashboard },
  { to: '/dashboard', label: 'Dashboard', icon: ShieldAlert },
]

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-[#05080f]/80 backdrop-blur-xl">
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

        <nav className="flex items-center gap-1.5 sm:gap-3">
          {links.map(({ to, label, icon: Icon }) => (
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
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}