import { ArrowLeft, FileText, Folder } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getSuhuellaApi } from '../lib/api'
import {
  buildPendingOrganiseContext,
  sourceBrowseOrganiseCta,
  sourceIdFromBrowsePath,
  type PendingOrganiseContext,
} from '../lib/organise-sources-bridge'
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
  onOrganise,
}: {
  rootPath: string
  title: string
  initialPath?: string
  onClose: () => void
  onOpenFile?: (path: string) => void
  onBrowsePathChange?: (path: string) => void
  onOrganise?: (context: PendingOrganiseContext) => void
}) {
  const [currentPath, setCurrentPath] = useState(initialPath && initialPath.startsWith(rootPath) ? initialPath : rootPath)
  const [browse, setBrowse] = useState<SourceBrowse | null>(null)
  const [loading, setLoading] = useState(true)
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([])

  useEffect(() => {
    onBrowsePathChange?.(currentPath)
  }, [currentPath, onBrowsePathChange])

  useEffect(() => {
    setSelectedFilePaths([])
    setHighlightPath(null)
  }, [currentPath])

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

  const selectedFiles = useMemo(
    () =>
      (browse?.entries ?? []).filter(
        (entry) => entry.kind === 'file' && selectedFilePaths.includes(entry.path),
      ),
    [browse?.entries, selectedFilePaths],
  )

  const atRoot = currentPath === rootPath
  const heading = atRoot ? title : browse?.name || title
  const organiseLabel = sourceBrowseOrganiseCta(selectedFiles.length)

  function toggleFileSelection(path: string) {
    setSelectedFilePaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    )
  }

  function openEntry(entry: SourceBrowseEntry) {
    if (entry.kind === 'folder') {
      setHighlightPath(entry.path)
      setCurrentPath(entry.path)
      return
    }
    if (onOrganise) {
      toggleFileSelection(entry.path)
      return
    }
    setHighlightPath(entry.path)
    onOpenFile?.(entry.path)
  }

  function startOrganise() {
    if (!onOrganise) return
    const context = buildPendingOrganiseContext({
      sourceId: sourceIdFromBrowsePath(rootPath),
      sourceTitle: title,
      folderScope: currentPath,
      fileIds: selectedFiles.map((file) => file.path),
      fileNames: selectedFiles.map((file) => file.name),
    })
    onOrganise(context)
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
              {onOrganise ? <th className="w-10 py-2 pr-2 font-semibold" aria-label="Select files" /> : null}
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="w-[88px] py-2 pr-4 text-right font-semibold">Size</th>
              <th className="w-[120px] py-2 pr-4 font-semibold">Kind</th>
              <th className="w-[168px] py-2 font-semibold">Date Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={onOrganise ? 5 : 4} className="py-10 text-[14px] text-[var(--app-fg)] opacity-50">
                  Loading…
                </td>
              </tr>
            ) : !browse || browse.entries.length === 0 ? (
              <tr>
                <td colSpan={onOrganise ? 5 : 4} className="py-10 text-[14px] text-[var(--app-fg)] opacity-50">
                  Nothing indexed in this source yet.
                </td>
              </tr>
            ) : (
              browse.entries.map((entry) => {
                const highlighted = highlightPath === entry.path
                const checked = entry.kind === 'file' && selectedFilePaths.includes(entry.path)
                return (
                  <tr
                    key={entry.path}
                    onClick={() => openEntry(entry)}
                    className={`cursor-pointer border-b border-[var(--sidebar-line)]/60 last:border-0 ${
                      highlighted || checked
                        ? 'bg-[var(--brand-accent)] text-white'
                        : 'text-[var(--app-fg)] hover:bg-[var(--overlay-row)]'
                    }`}
                  >
                    {onOrganise ? (
                      <td className="py-1.5 pr-2">
                        {entry.kind === 'file' ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            aria-label={`Select ${entry.name}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleFileSelection(entry.path)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="py-1.5 pr-4">
                      <span className="flex min-w-0 items-center gap-2.5">
                        {entry.kind === 'folder' ? (
                          <Folder
                            className={`h-4 w-4 shrink-0 ${highlighted ? 'opacity-90' : 'opacity-50'}`}
                            strokeWidth={1.75}
                          />
                        ) : (
                          <FileText
                            className={`h-4 w-4 shrink-0 ${highlighted || checked ? 'opacity-90' : 'opacity-50'}`}
                            strokeWidth={1.75}
                          />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </span>
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right tabular-nums ${highlighted || checked ? 'opacity-90' : 'opacity-55'}`}
                    >
                      {entry.kind === 'folder' || entry.size == null ? '—' : formatStorageSize(entry.size)}
                    </td>
                    <td className={`py-1.5 pr-4 ${highlighted || checked ? 'opacity-90' : 'opacity-55'}`}>
                      {sourceBrowseKindLabel(entry)}
                    </td>
                    <td className={`py-1.5 ${highlighted || checked ? 'opacity-90' : 'opacity-55'}`}>
                      {formatBrowseDate(entry.lastModified)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {onOrganise ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sidebar-line)] pt-4">
          <p className="text-[13px] text-[var(--app-fg)] opacity-55">
            {selectedFiles.length > 0
              ? `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected`
              : 'Select files or organise this folder'}
          </p>
          <button
            type="button"
            onClick={startOrganise}
            className="rounded-full bg-[var(--app-fg)] px-4 py-2 text-[13px] font-semibold text-[var(--app-bg)] transition hover:opacity-90"
          >
            {organiseLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
