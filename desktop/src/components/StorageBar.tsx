import { brand } from '@suhuella/brand'
import { formatStorageSize } from '../lib/storage-format'

export type StorageSegment = {
  id: string
  label: string
  bytes: number
  color: string
  detail?: string
}

export const STORAGE_COLORS = [
  brand.theme.accent,
  '#5856D6',
  '#5AC8FA',
  '#34C759',
  '#FF9500',
  '#AF52DE',
  '#FF2D55',
  '#8E8E93',
] as const

export function StorageBar({
  title,
  subtitle,
  segments,
  totalLabel = 'Total',
  loading,
  emptyMessage,
  footer,
  showZeroValues = false,
}: {
  title: string
  subtitle?: string
  segments: StorageSegment[]
  totalLabel?: string
  loading?: boolean
  emptyMessage?: string
  footer?: string
  showZeroValues?: boolean
}) {
  const visible = showZeroValues ? segments : segments.filter((segment) => segment.bytes > 0)
  const totalBytes = visible.reduce((sum, segment) => sum + segment.bytes, 0)

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p> : null}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-full rounded-full bg-slate-100" />
          <div className="flex gap-3">
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage ?? 'Nothing to measure yet.'}</p>
      ) : (
        <>
          <div className="mb-3 flex items-end justify-between gap-3">
            <span className="text-[13px] font-semibold text-slate-700">
              {formatStorageSize(totalBytes)}{' '}
              <span className="font-normal text-slate-400">{totalLabel.toLowerCase()}</span>
            </span>
          </div>

          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {visible.map((segment) => {
              const width = totalBytes > 0 ? Math.max(0.5, (segment.bytes / totalBytes) * 100) : 0
              return (
                <div
                  key={segment.id}
                  className="h-full"
                  style={{ width: `${width}%`, backgroundColor: segment.color }}
                  title={`${segment.label} · ${formatStorageSize(segment.bytes)}`}
                />
              )
            })}
          </div>

          <ul className="mt-3 space-y-2">
            {visible.map((segment) => (
              <li key={segment.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{segment.label}</p>
                    {segment.detail ? (
                      <p className="text-[12px] text-slate-500">{segment.detail}</p>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 font-semibold text-slate-800">
                  {formatStorageSize(segment.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {footer ? <p className="mt-4 text-[12px] text-slate-500">{footer}</p> : null}
    </div>
  )
}
