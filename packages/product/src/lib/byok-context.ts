import { destinationLabel } from './plan-editor-copy.ts'
import type {
  ActivityPeriodSummary,
  ByokActivityContext,
  ByokAlternativeContext,
  ByokFolderFileContext,
  ByokPlanContextItem,
  ByokRecommendationContext,
  OrganisationPlanItem,
  RecommendedFolder,
} from '../types'

export function recommendationToByokContext(
  fileName: string,
  item: RecommendedFolder,
  options?: {
    alternatives?: RecommendedFolder[]
    notRecommendedQuestion?: string
  },
): ByokRecommendationContext {
  const alternatives: ByokAlternativeContext[] | undefined = options?.alternatives
    ?.filter((alt) => alt.folder !== item.folder)
    .slice(0, 4)
    .map((alt) => ({
      folderLabel: alt.label,
      confidenceLabel: alt.confidenceLabel,
      reasons: alt.reasons,
    }))

  return {
    fileName,
    folderLabel: item.label,
    confidenceLabel: item.confidenceLabel,
    reasons: item.reasons,
    alternatives: alternatives && alternatives.length > 0 ? alternatives : undefined,
    notRecommendedQuestion: options?.notRecommendedQuestion,
  }
}

export function planItemsToByokContext(items: OrganisationPlanItem[]): ByokPlanContextItem[] {
  return items.map((item) => ({
    fileName: item.fileName,
    action: item.action,
    destinationLabel: item.proposedPath ? destinationLabel(item) : null,
    confidenceLabel: item.confidenceLabel,
    explanation: item.explanation,
  }))
}

export function planItemsToFolderContext(items: OrganisationPlanItem[]): ByokFolderFileContext[] {
  return items.map((item) => ({
    fileName: item.fileName,
    action: item.action,
    destinationLabel: item.proposedPath ? destinationLabel(item) : null,
    explanation: item.explanation,
  }))
}

export function activityToByokContext(summary: ActivityPeriodSummary): ByokActivityContext {
  return {
    label: summary.label,
    organised: summary.organised,
    moved: summary.moved,
    skipped: summary.skipped,
    failed: summary.failed,
    topDestinations: summary.topDestinations,
  }
}
