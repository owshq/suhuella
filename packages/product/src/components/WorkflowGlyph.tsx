import { Camera, Download, FileText, Receipt, Star, type LucideIcon } from 'lucide-react'
import { workflowIconKind, type WorkflowIconKind } from '../lib/workflow-copy'

const ICONS: Record<WorkflowIconKind, LucideIcon> = {
  downloads: Download,
  invoices: Receipt,
  contracts: FileText,
  photos: Camera,
  custom: Star,
}

const TONES: Record<WorkflowIconKind, string> = {
  downloads: 'bg-blue-50 text-blue-500',
  invoices: 'bg-amber-50 text-amber-600',
  contracts: 'bg-slate-100 text-slate-600',
  photos: 'bg-rose-50 text-rose-500',
  custom: 'bg-violet-50 text-violet-500',
}

export function WorkflowGlyph({
  name,
  category,
  className = 'h-4 w-4',
}: {
  name: string
  category?: string | null
  className?: string
}) {
  const kind = workflowIconKind({ name, category })
  const Icon = ICONS[kind]
  return <Icon className={className} />
}

export function WorkflowGlyphBadge({
  name,
  category,
}: {
  name: string
  category?: string | null
}) {
  const kind = workflowIconKind({ name, category })
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[kind]}`}>
      <WorkflowGlyph name={name} category={category} />
    </div>
  )
}
