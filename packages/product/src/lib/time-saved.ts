/** Conservative local estimate of manual folder-picking time. Hidden until enough real moves exist. */
export const MANUAL_SECONDS_PER_DOCUMENT = 20
export const MIN_DOCUMENTS_FOR_ESTIMATE = 8

export function estimateTimeSaved(organisedCount: number): string | null {
  if (!Number.isFinite(organisedCount) || organisedCount < MIN_DOCUMENTS_FOR_ESTIMATE) {
    return null
  }

  const seconds = organisedCount * MANUAL_SECONDS_PER_DOCUMENT
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) {
    return `≈ ${minutes} minute${minutes === 1 ? '' : 's'}`
  }

  const hours = Math.round(minutes / 60)
  return `≈ ${hours} hour${hours === 1 ? '' : 's'}`
}
