import type { ReactNode } from 'react'

/** List-row pattern aligned with SourcesPanel SourceCard (list layout). */
export function PermissionRow({
  title,
  statusLine,
  detail,
  trailing,
  disabled,
}: {
  title: string
  statusLine: string
  detail?: string
  trailing: ReactNode
  disabled?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-[var(--overlay-row)] px-3 py-3 last:border-0 rounded-xl transition ${
        disabled ? 'opacity-55' : 'hover:bg-[var(--overlay-row)]'
      }`}
      aria-disabled={disabled || undefined}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[var(--app-fg)]">{title}</p>
        <p className="mt-0.5 text-[13px] font-medium text-[var(--app-fg)] opacity-70">{statusLine}</p>
        {detail ? (
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--app-fg)] opacity-50">{detail}</p>
        ) : null}
      </div>
      <div className="shrink-0">{trailing}</div>
    </div>
  )
}

export function PermissionToggle({
  checked,
  disabled,
  busy,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  busy?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-busy={busy || undefined}
        checked={checked}
        disabled={disabled || busy}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-[var(--sidebar-line)] text-[var(--brand-accent)] accent-[var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  )
}
