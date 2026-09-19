import path from 'node:path'
import { isFolderCreateAction } from '../src/lib/plan-editor-copy.ts'
import type {
  ActivityItem,
  ActivityRun,
  KnowledgeSet,
  OrganisationPlan,
  OrganisationPlanItem,
} from '../src/types.ts'

function samePath(left: string, right: string): boolean {
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase()
}

function reversiblePlanItem(item: OrganisationPlanItem): item is OrganisationPlanItem & {
  proposedPath: string
} {
  return (
    item.status === 'applied' &&
    (item.action === 'move' || isFolderCreateAction(item.action) || item.action === 'rename') &&
    typeof item.proposedPath === 'string' &&
    item.proposedPath.trim().length > 0
  )
}

export function replayableApprovedPlan(plan: OrganisationPlan): OrganisationPlan {
  const items = plan.items
    .filter(
      (item) =>
        item.selected === true &&
        (item.action === 'move' || isFolderCreateAction(item.action) || item.action === 'rename') &&
        typeof item.proposedPath === 'string' &&
        item.proposedPath.trim().length > 0,
    )
    .map((item) => ({
      ...item,
      status: 'preview' as const,
      selected: true,
      reviewGroup: 'ready' as const,
      skipReason: null,
      warnings: [],
    }))

  return {
    knowledgeSet: {
      items: items.map((item) => ({
        path: item.currentPath,
        kind: 'file' as const,
      })),
    },
    items,
  }
}

export function planFromExecutedItems(
  items: OrganisationPlanItem[],
  knowledgeSet?: KnowledgeSet,
): OrganisationPlan {
  return {
    knowledgeSet: knowledgeSet ?? {
      items: items.map((item) => ({
        path: item.currentPath,
        kind: 'file' as const,
      })),
    },
    items,
  }
}

export function buildInverseOrganisationPlan(plan: OrganisationPlan): OrganisationPlan {
  const items = plan.items.filter(reversiblePlanItem).map((item) => ({
    ...item,
    action: item.action === 'rename' ? ('rename' as const) : ('move' as const),
    currentPath: path.normalize(item.proposedPath),
    proposedPath: path.normalize(item.currentPath),
    status: 'preview' as const,
    selected: true,
    reviewGroup: 'ready' as const,
    skipReason: null,
    warnings: [],
    explanation: item.action === 'rename' ? 'Restore original name' : 'Restore to original location',
    ...(item.createdFolders && item.createdFolders.length > 0
      ? { createdFolders: item.createdFolders }
      : {}),
  }))

  return {
    knowledgeSet: {
      items: items.map((item) => ({
        path: item.currentPath,
        kind: 'file' as const,
      })),
    },
    items,
  }
}

function inversePlanFromActivityItems(items: ActivityItem[]): OrganisationPlan {
  const planItems: OrganisationPlanItem[] = items
    .filter(
      (item) =>
        item.status === 'moved' &&
        (item.action === 'move' || isFolderCreateAction(item.action) || item.action === 'rename') &&
        Boolean(item.targetPath),
    )
    .map((item) => ({
      action: item.action === 'rename' ? 'rename' : 'move',
      currentPath: path.normalize(item.targetPath!),
      proposedPath: path.normalize(item.sourcePath),
      explanation: item.action === 'rename' ? 'Restore original name' : 'Restore to original location',
      status: 'preview',
      warnings: [],
      reviewGroup: 'ready',
      selected: true,
      fileName: item.fileName,
      score: item.confidence,
      confidenceLabel: null,
      alternatives: [],
      skipReason: null,
      ...(item.createdFolders && item.createdFolders.length > 0
        ? { createdFolders: item.createdFolders }
        : {}),
    }))

  return {
    knowledgeSet: {
      items: planItems.map((item) => ({
        path: item.currentPath,
        kind: 'file' as const,
      })),
    },
    items: planItems,
  }
}

export function inversePlanFromActivityRun(run: ActivityRun): OrganisationPlan {
  if (run.inversePlan && run.inversePlan.items.length > 0) {
    return run.inversePlan
  }
  if (run.plan && run.plan.items.some((item) => item.status === 'applied')) {
    return buildInverseOrganisationPlan(run.plan)
  }
  return inversePlanFromActivityItems(run.items)
}

export function filterInversePlan(
  plan: OrganisationPlan,
  sourcePaths: string[] | null,
): OrganisationPlan {
  if (!sourcePaths || sourcePaths.length === 0) return plan
  const wanted = sourcePaths.map((value) => path.normalize(value))
  const items = plan.items.filter((item) =>
    wanted.some((value) => item.proposedPath != null && samePath(value, item.proposedPath)),
  )
  return {
    knowledgeSet: {
      items: items.map((item) => ({
        path: item.currentPath,
        kind: 'file' as const,
      })),
    },
    items,
  }
}
