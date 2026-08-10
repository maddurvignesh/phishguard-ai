// Animated cybersecurity ambient background (static DOM + CSS, GPU friendly).

export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-cybergrid" />
      <div className="absolute inset-0 bg-scanline opacity-60" />
      <div className="orb-a glow-orb animate-float-slow" style={{ width: 420, height: 420, top: '-8%', left: '-6%' }} />
      <div className="orb-b glow-orb animate-float-slow" style={{ width: 360, height: 360, top: 28, right: '-4%', animationDelay: '-6s' }} />
      <div className="orb-c glow-orb animate-float-slow" style={{ width: 420, height: 420, bottom: '-12%', left: '28%', animationDelay: '-11s' }} />
      {/* sparse network nodes */}
      <div className="animate-pulse-glow absolute h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ top: '18%', left: '12%' }} />
      <div className="animate-pulse-glow absolute h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ top: '26%', left: '41%', animationDelay: '1s' }} />
      <div className="animate-pulse-glow absolute h-1 w-1 rounded-full bg-sky-400" style={{ top: '12%', right: '18%', animationDelay: '2s' }} />
      <div className="animate-pulse-glow absolute h-1 w-1 rounded-full bg-sky-400" style={{ bottom: '30%', right: '30%', animationDelay: '0.5s' }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 105%, rgba(56,189,248,0.08), transparent 60%)' }}
      />
    </div>
  )
}