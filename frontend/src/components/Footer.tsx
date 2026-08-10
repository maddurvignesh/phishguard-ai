export default function Footer() {
  return (
    <footer className="mt-20 border-t border-edge/60 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
        <div>
          <div className="font-display text-sm font-semibold text-slate-200">
            PhishGuard <span className="text-gradient">AI</span>
          </div>
          <p className="mt-1 max-w-xl text-xs text-mist">
            A supervised machine-learning system that analyzes URL characteristics to estimate
            phishing risk. Treat every result as a risk estimate — always verify before entering
            credentials.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-mist/70">
          Python · Scikit-learn · FastAPI · React
        </div>
      </div>
    </footer>
  )
}