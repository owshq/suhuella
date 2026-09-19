import { ArrowLeft, FileText, Folder } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSuhuellaApi } from '../lib/api'
import { formatStorageSize } from '../lib/storage-format'
import { formatBrowseDate, isBrowsePathUnder, sourceBrowseKindLabel } from '../lib/source-browse'
import type { SourceBrowse, SourceBrowseEntry } from '../types'

export function SourceBrowsePanel({
  rootPath,
  title,
  initialPath,
  onClose,
  onOpenFile,
  onBrowsePathChange,
}: {
  rootPath: string
  title: string
  initialPath?: string
  onClose: () => void
  onOpenFile?: (path: string) => void
  onBrowsePathChange?: (path: string) => void
}) {
  const [currentPath, setCurrentPath] = useState(initialPath && initialPath.startsWith(rootPath) ? initialPath : rootPath)
  const [browse, setBrowse] = useState<SourceBrowse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    onBrowsePathChange?.(currentPath)
  }, [currentPath, onBrowsePathChange])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getSuhuellaApi()
      .browseSource(currentPath)
      .then((next) => {
        if (!cancelled) setBrowse(next)
      })
      .catch(() => {
        if (!cancelled) setBrowse({ path: currentPath, name: title, parentPath: null, entries: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentPath, title])

  const atRoot = currentPath === rootPath
  const heading = atRoot ? title : browse?.name || title

  function openEntry(entry: SourceBrowseEntry) {
    setSelectedPath(entry.path)
    if (entry.kind === 'folder') {
      setCurrentPath(entry.path)
      return
    }
    onOpenFile?.(entry.path)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (atRoot) {
              onClose()
              return
            }
            setCurrentPath(
              browse?.parentPath && isBrowsePathUnder(rootPath, browse.parentPath)
                ? browse.parentPath
                : rootPath,
            )
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-fg)] opacity-60 transition hover:bg-[var(--overlay-row)] hover:opacity-100"
          aria-label={atRoot ? 'Back to Sources' : 'Back'}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <h1 className="truncate text-[28px] font-semibold tracking-tight text-[var(--app-fg)]">{heading}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-[var(--app-bg)] text-[11px] font-semibold uppercase tracking-wide text-[var(--app-fg)] opacity-45">
            <tr className="border-b border-[var(--sidebar-line)]">
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="w-[88px] py-2 pr-4 text-right font-semibold">Size</th>
              <th className="w-[120px] py-2 pr-4 font-semibold">Kind</th>
              <th className="w-[168px] py-2 font-semibold">Date Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-10 text-[14px] text-[var(--app-fg)] opacity-50">
                  Loading…
                </td>
              </tr>
            ) : !browse || browse.entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-[14px] text-[var(--app-fg)] opacity-50">
                  Nothing indexed in this source yet.
                </td>
              </tr>
            ) : (
              browse.entries.map((entry) => {
                const selected = selectedPath === entry.path
                return (
                  <tr
                    key={entry.path}
                    onClick={() => openEntry(entry)}
                    className={`cursor-pointer border-b border-[var(--sidebar-line)]/60 last:border-0 ${
                      selected
                        ? 'bg-[var(--brand-accent)] text-white'
                        : 'text-[var(--app-fg)] hover:bg-[var(--overlay-row)]'
                    }`}
                  >
                    <td className="py-1.5 pr-4">
                      <span className="flex min-w-0 items-center gap-2.5">
                        {entry.kind === 'folder' ? (
                          <Folder className={`h-4 w-4 shrink-0 ${selected ? 'opacity-90' : 'opacity-50'}`} strokeWidth={1.75} />
                        ) : (
                          <FileText className={`h-4 w-4 shrink-0 ${selected ? 'opacity-90' : 'opacity-50'}`} strokeWidth={1.75} />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </span>
                    </td>
                    <td className={`py-1.5 pr-4 text-right tabular-nums ${selected ? 'opacity-90' : 'opacity-55'}`}>
                      {entry.kind === 'folder' || entry.size == null ? '—' : formatStorageSize(entry.size)}
                    </td>
                    <td className={`py-1.5 pr-4 ${selected ? 'opacity-90' : 'opacity-55'}`}>
                      {sourceBrowseKindLabel(entry)}
                    </td>
                    <td className={`py-1.5 ${selected ? 'opacity-90' : 'opacity-55'}`}>
                      {formatBrowseDate(entry.lastModified)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
