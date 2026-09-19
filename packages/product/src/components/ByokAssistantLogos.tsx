/** Lightweight assistant marks — inline SVG only, no external assets. */

export function OpenAiLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#10A37F"
        d="M11.5 2.2a6.8 6.8 0 0 1 5.8 3.2 5.2 5.2 0 0 1 1.9-.4 5.2 5.2 0 0 1 5.2 5.2 5.2 5.2 0 0 1-1.1 3.2 6.8 6.8 0 0 1-1.2 8.3 6.8 6.8 0 0 1-8.3 1.2 5.2 5.2 0 0 1-3.2 1.9 5.2 5.2 0 0 1-5.2-5.2 5.2 5.2 0 0 1 1.1-3.2 6.8 6.8 0 0 1 1.2-8.3 6.8 6.8 0 0 1 6.5-1.9Z"
      />
    </svg>
  )
}

export function AnthropicLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#D97757" d="M12 2 4 20h3.2l1.2-3h7.2l1.2 3H20L12 2Zm0 5.8 2.4 6.2H9.6L12 7.8Z" />
    </svg>
  )
}

export function CompatibleApiLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        stroke="var(--brand-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M8 12h8M12 8v8M7 7l10 10"
      />
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="#64748B" strokeWidth="1.6" />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="#64748B" strokeWidth="1.6" />
    </svg>
  )
}

export function LocalServerLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect x="4" y="4" width="16" height="6" rx="1.5" stroke="#64748B" strokeWidth="1.6" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" stroke="#64748B" strokeWidth="1.6" />
      <circle cx="8" cy="7" r="1" fill="#10B981" />
      <circle cx="8" cy="17" r="1" fill="#10B981" />
    </svg>
  )
}

export function LocalIntelligenceLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        stroke="var(--brand-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
      />
      <circle cx="12" cy="12" r="3.5" stroke="var(--brand-accent)" strokeWidth="1.8" />
    </svg>
  )
}
