export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ci-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 L56 12 V34 C56 52 46 62 32 68 C18 62 8 52 8 34 V12 Z"
        fill="rgba(8,20,38,0.6)"
        stroke="url(#ci-mark-g)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="35" r="11.5" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" />
      <circle cx="32" cy="35" r="6.5" fill="#a5f3fc" />
      <line x1="32" y1="29" x2="32" y2="21" stroke="url(#ci-mark-g)" strokeWidth="1.5" opacity="0.85" strokeLinecap="round" />
      <line x1="38" y1="38" x2="45" y2="42" stroke="url(#ci-mark-g)" strokeWidth="1.5" opacity="0.85" strokeLinecap="round" />
      <line x1="26" y1="38" x2="19" y2="42" stroke="url(#ci-mark-g)" strokeWidth="1.5" opacity="0.85" strokeLinecap="round" />
    </svg>
  )
}
