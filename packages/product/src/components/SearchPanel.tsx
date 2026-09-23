import { Archive, Clock3, FileText, Folder, FolderKanban, Image } from 'lucide-react'
import { useAppLocale } from '../lib/app-locale'
import { hostAccessFor } from '../lib/platform-capabilities'
import { searchEmptyQueryCopy, searchNoSourcesCopy } from '../lib/sources-ui'
import type { AppInfo, SearchDocumentFilter, SearchHit, SearchResults } from '../types'

export const SEARCH_FILTERS: Array<{ id: Exclude<SearchDocumentFilter, 'all'>; label: string }> = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'images', label: 'Images' },
  { id: 'archives', label: 'Archives' },
  { id: 'other', label: 'Other' },
]

export function revealLabel(platform: AppInfo['platform']): string {
  if (platform === 'win32') return 'Reveal in Explorer'
  if (platform === 'darwin') return 'Reveal in Finder'
  return 'Show in folder'
}

function kindLabel(hit: SearchHit): string {
  if (hit.kind === 'folder' || hit.kind === 'recent') return 'Folder'
  if (hit.kind === 'workflow') return 'Workflow'
  if (hit.kind === 'activity') return 'Activity'
  if (hit.kind === 'recommendation') return 'Recommendation'
  if (hit.documentFilter === 'pdf') return 'PDF'
  if (hit.documentFilter === 'docx') return 'DOCX'
  if (hit.documentFilter === 'images') return 'Image'
  if (hit.documentFilter === 'archives') return 'Archive'
  return 'Document'
}

function KindIcon({ hit, className }: { hit: SearchHit; className: string }) {
  if (hit.kind === 'folder' || hit.kind === 'recent') return <Folder className={className} strokeWidth={1.75} />
  if (hit.kind === 'workflow') return <FolderKanban className={className} strokeWidth={1.75} />
  if (hit.kind === 'activity' || hit.kind === 'recommendation') {
    return <Clock3 className={className} strokeWidth={1.75} />
  }
  if (hit.documentFilter === 'images') return <Image className={className} strokeWidth={1.75} />
  if (hit.documentFilter === 'archives') return <Archive className={className} strokeWidth={1.75} />
  return <FileText className={className} strokeWidth={1.75} />
}

function tileTone(hit: SearchHit): string {
  if (hit.documentFilter === 'pdf') return 'from-rose-50 to-rose-100/80 text-rose-700'
  if (hit.documentFilter === 'docx') return 'from-sky-50 to-sky-100/80 text-sky-700'
  if (hit.documentFilter === 'images') return 'from-amber-50 to-amber-100/70 text-amber-700'
  if (hit.documentFilter === 'archives') return 'from-violet-50 to-violet-100/80 text-violet-700'
  if (hit.kind === 'folder' || hit.kind === 'recent') return 'from-slate-50 to-slate-100 text-slate-600'
  if (hit.kind === 'workflow') return 'from-blue-50 to-blue-100/80 text-blue-700'
  return 'from-slate-50 to-slate-100 text-slate-600'
}

export function SearchResultsPanel({
  query,
  results,
  loading,
  filter,
  platform,
  nativeReveal = true,
  onFilterChange,
  onOpen,
  onReveal,
  onShowRecommendation: _onShowRecommendation,
  onShowWorkflow,
  onShowActivity,
  sourceCount = 0,
  indexedDocumentCount = 0,
  host,
}: {
  query: string
  results: SearchResults | null
  loading: boolean
  filter: SearchDocumentFilter
  platform: AppInfo['platform']
  nativeReveal?: boolean
  sourceCount?: number
  indexedDocumentCount?: number
  host?: AppInfo['host']
  onFilterChange: (value: SearchDocumentFilter) => void
  onOpen: (hit: SearchHit) => void
  onReveal: (hit: SearchHit) => void
  onShowRecommendation: (hit: SearchHit) => void
  onShowWorkflow: (hit: SearchHit) => void
  onShowActivity: (hit: SearchHit) => void
}) {
  const { locale } = useAppLocale()
  const access = hostAccessFor(host)
  const reveal = revealLabel(platform)
  const hits = results?.hits ?? []
  const emptyQuery = !query.trim() && filter === 'all'

  function openPrimary(hit: SearchHit) {
    if (hit.path) {
      onOpen(hit)
      return
    }
    if (hit.kind === 'workflow' && hit.workflowId) {
      onShowWorkflow(hit)
      return
    }
    onShowActivity(hit)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header>
        <div className="flex flex-wrap gap-2">
          {SEARCH_FILTERS.map((item) => {
            const active = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterChange(active ? 'all' : item.id)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)]'
                    : 'bg-[var(--overlay-row)] text-[var(--overlay-muted)] ring-1 ring-[var(--sidebar-line)] hover:bg-[var(--overlay-row)] hover:text-[var(--app-fg)]'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </header>

      {loading && hits.length === 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <div className="skeleton aspect-[3/4] rounded-[1.35rem]" />
              <div className="skeleton mt-2.5 h-3 w-3/4" />
              <div className="skeleton mt-1.5 h-2.5 w-1/3" />
            </li>
          ))}
        </ul>
      ) : hits.length === 0 ? (
        <p className="pt-10 text-center text-[15px] text-slate-400">
          {emptyQuery
            ? searchEmptyQueryCopy(access, sourceCount, locale)
            : sourceCount === 0
              ? searchNoSourcesCopy(access)
              : indexedDocumentCount > 0
                ? 'No documents match this search.'
                : 'Nothing matches. Try another name.'}
        </p>
      ) : (
        <section>
          <h2 className="mb-4 text-[13px] font-semibold text-slate-500">
            {emptyQuery ? 'Recent' : 'Results'}
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {hits.map((hit) => {
              const canReveal = Boolean(hit.path)
              const canWorkflow = Boolean(hit.workflowId)
              const canActivity = Boolean(hit.activityRunId) || hit.kind === 'activity'
              return (
                <li key={hit.id} className="group">
                  <button
                    type="button"
                    onClick={() => openPrimary(hit)}
                    className="block w-full text-left"
                  >
                    <div
                      className={`flex aspect-[3/4] items-center justify-center rounded-[1.35rem] bg-gradient-to-b shadow-sm ring-1 ring-black/5 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md ${tileTone(hit)}`}
                    >
                      <KindIcon hit={hit} className="h-12 w-12 opacity-80" />
                    </div>
                    <p className="mt-2.5 truncate text-[13px] font-semibold text-slate-900">{hit.title}</p>
                    <p className="truncate text-[12px] text-slate-500">{hit.subtitle || kindLabel(hit)}</p>
                  </button>
                  <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-500">
                    {hit.kind === 'file' && !nativeReveal ? (
                      <span>Open is limited in browser</span>
                    ) : null}
                    {canReveal && nativeReveal ? (
                      <button type="button" onClick={() => onReveal(hit)} className="hover:text-slate-900">
                        {reveal}
                      </button>
                    ) : null}
                    {canWorkflow ? (
                      <button type="button" onClick={() => onShowWorkflow(hit)} className="hover:text-slate-900">
                        Workflow
                      </button>
                    ) : null}
                    {canActivity ? (
                      <button type="button" onClick={() => onShowActivity(hit)} className="hover:text-slate-900">
                        Activity
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
