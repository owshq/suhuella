import { productCopy } from '../lib/product-copy'
import { ChevronRight } from 'lucide-react'
import { formatDayLabel } from '../lib/folders-ui'
type LearningSummaryCardProps = {
  folderCount: number
  fileCount: number
  lastIndexed: string | null
  learningStatus: string
  onClick?: () => void
  compact?: boolean
}

function statusTone(status: string): string {
  if (status === 'Excellent' || status === 'Good') return 'text-emerald-700'
  return 'text-amber-800'
}

export function LearningSummaryCard({
  folderCount,
  fileCount,
  lastIndexed,
  learningStatus,
  onClick,
  compact = false,
}: LearningSummaryCardProps) {
  const lastUpdated = formatDayLabel(lastIndexed)
  const interactive = Boolean(onClick)
  const Wrapper = interactive ? 'button' : 'div'

  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-[1.6rem] border border-white/70 bg-white/80 text-left shadow-lg shadow-blue-900/5 ${
        interactive ? 'transition hover:bg-white' : ''
      } ${compact ? 'px-4 py-3.5' : 'px-5 py-4'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{productCopy('SuHuella is learning from')}</p>
          <dl className={`${compact ? 'mt-2' : 'mt-3'} space-y-1 text-sm`}>
            <div className="flex items-center justify-between gap-6">
              <dt className="text-slate-500">Folders</dt>
              <dd className="font-semibold text-slate-900">{folderCount.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between gap-6">
              <dt className="text-slate-500">Files</dt>
              <dd className="font-semibold text-slate-900">{fileCount.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between gap-6">
              <dt className="text-slate-500">Last updated</dt>
              <dd className="font-semibold text-slate-900">{lastUpdated}</dd>
            </div>
            <div className="flex items-center justify-between gap-6">
              <dt className="text-slate-500">Learning status</dt>
              <dd className={`font-semibold ${statusTone(learningStatus)}`}>{learningStatus}</dd>
            </div>
          </dl>
        </div>
        {interactive ? <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" /> : null}
      </div>
    </Wrapper>
  )
}
