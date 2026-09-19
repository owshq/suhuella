const RECOGNISED_HINTS: Array<{ label: string; hints: string[] }> = [
  { label: 'Invoices', hints: ['invoice', 'invoices', 'factura', 'facturas', 'factures'] },
  { label: 'Contracts', hints: ['contract', 'contracts', 'contrato', 'contratos', 'contracte', 'contractes'] },
  { label: 'Budgets', hints: ['budget', 'budgets', 'presupuesto', 'presupuestos', 'pressupost'] },
  { label: 'Projects', hints: ['project', 'projects', 'proyecto', 'proyectos', 'projecte', 'projectes'] },
  { label: 'Reports', hints: ['report', 'reports', 'informe', 'informes'] },
  { label: 'Photos', hints: ['photo', 'photos', 'image', 'images', 'foto', 'fotos'] },
]

const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif']

/** Same labels Desktop Home shows. Presentation of the Knowledge Index, not a new engine. */
export function recognisedFromNames(names: string[], extensions: string[]): string[] {
  const haystack = names.join(' ').toLowerCase()
  const found = RECOGNISED_HINTS.filter((item) => item.hints.some((hint) => haystack.includes(hint))).map(
    (item) => item.label,
  )
  const hasPhotos =
    found.includes('Photos') || extensions.some((extension) => PHOTO_EXTENSIONS.includes(extension.toLowerCase()))
  return hasPhotos && !found.includes('Photos') ? [...found, 'Photos'] : found
}

export function uniqueNameCount(names: string[]): number {
  return new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean)).size
}
