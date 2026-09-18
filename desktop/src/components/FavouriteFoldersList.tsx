import { Folder, FolderPlus, FolderSearch, Trash2 } from 'lucide-react'

type FavouriteFoldersListProps = {
  folders: string[]
  busy?: boolean
  onAdd: () => void
  onRemove: (folder: string) => void
}

function folderName(folder: string): string {
  const parts = folder.split(/[/\\]+/).filter(Boolean)
  return parts.at(-1) ?? folder
}

export function FavouriteFoldersList({
  folders,
  busy = false,
  onAdd,
  onRemove,
}: FavouriteFoldersListProps) {
  if (folders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 px-4 py-8 text-center">
        <FolderSearch className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">No favourite folders yet.</p>
        <p className="mt-1 text-xs text-slate-500">
          Add the places where you usually save files.
        </p>
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0084FF] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_-10px_rgba(0,132,255,0.7)] transition hover:bg-[#0076e6] disabled:opacity-60"
        >
          <FolderPlus className="h-4 w-4" />
          Add first folder
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0084FF] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_-10px_rgba(0,132,255,0.7)] transition hover:bg-[#0076e6] disabled:opacity-60"
        >
          <FolderPlus className="h-4 w-4" />
          Add folder
        </button>
      </div>
      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
        {folders.map((folder) => (
          <div
            key={folder}
            className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0084FF]/10 text-[#0084FF]">
              <Folder className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{folderName(folder)}</p>
              <p className="truncate font-mono text-[11px] text-slate-500">{folder}</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(folder)}
              className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
              aria-label={`Remove ${folder}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
