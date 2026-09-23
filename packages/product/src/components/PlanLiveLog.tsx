import {
  PLAN_LIVE_LOG_DONE,
  PLAN_LIVE_LOG_TITLE,
  type PlanLiveLogLine,
} from '../lib/plan-execution-copy'

function toneClass(tone: PlanLiveLogLine['tone']): string {
  if (tone === 'applied') return 'text-emerald-700'
  if (tone === 'failed') return 'text-rose-700'
  if (tone === 'skipped') return 'text-amber-800'
  return 'text-slate-500'
}

export function PlanLiveLog({
  lines,
  complete,
}: {
  lines: PlanLiveLogLine[]
  complete: boolean
}) {
  if (lines.length === 0 && !complete) return null

  return (
    <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] p-4">
      <p className="text-[13px] font-semibold text-[var(--app-fg)]">{PLAN_LIVE_LOG_TITLE}</p>
      <ul className="mt-3 max-h-64 space-y-2 overflow-auto font-mono text-[12px]">
        {lines.map((line) => (
          <li key={line.id} className="rounded-xl bg-[var(--app-bg)] px-3 py-2">
            <span className="text-[var(--app-fg)]">{line.origin}</span>
            <span className="text-[var(--app-fg)] opacity-40"> → </span>
            <span className="text-[var(--app-fg)]">{line.destination}</span>
            <span className="text-[var(--app-fg)] opacity-40"> · </span>
            <span className={toneClass(line.tone)}>{line.result}</span>
          </li>
        ))}
      </ul>
      {complete ? (
        <p className="mt-3 text-[12px] text-[var(--app-fg)] opacity-55">{PLAN_LIVE_LOG_DONE}</p>
      ) : null}
    </div>
  )
}
