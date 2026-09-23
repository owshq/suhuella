import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { duplicateSavedPlan, parseSavedPlan, planFromDraft } from '@suhuella/product/lib/saved-plan.ts'
import type { KnowledgeSetValidationError, SavedPlan, SavedPlanDraft } from '@suhuella/product/types.ts'

type PlanStoreResult<T> = { ok: true; data: T } | { ok: false; error: KnowledgeSetValidationError }

export const PLANS_FILE = 'plans.json'
export const PLANS_LOG_VERSION = 1

type PlanLog = {
  version: number
  updatedAt: string
  plans: SavedPlan[]
}

function plansPath(userDataDir: string): string {
  return path.join(userDataDir, PLANS_FILE)
}

function readLog(userDataDir: string): PlanLog {
  const file = plansPath(userDataDir)
  if (!existsSync(file)) return { version: PLANS_LOG_VERSION, updatedAt: '', plans: [] }
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as PlanLog).plans)) {
      return { version: PLANS_LOG_VERSION, updatedAt: '', plans: [] }
    }
    const plans = (parsed as PlanLog).plans.map(parseSavedPlan).filter((plan): plan is SavedPlan => plan !== null)
    return { version: PLANS_LOG_VERSION, updatedAt: (parsed as PlanLog).updatedAt ?? '', plans }
  } catch {
    return { version: PLANS_LOG_VERSION, updatedAt: '', plans: [] }
  }
}

function writeLog(userDataDir: string, plans: SavedPlan[]): void {
  mkdirSync(userDataDir, { recursive: true })
  const log: PlanLog = {
    version: PLANS_LOG_VERSION,
    updatedAt: new Date().toISOString(),
    plans,
  }
  writeFileSync(plansPath(userDataDir), JSON.stringify(log, null, 2))
}

export function listSavedPlans(userDataDir: string): SavedPlan[] {
  return readLog(userDataDir).plans
}

export function saveSavedPlan(userDataDir: string, draft: unknown): PlanStoreResult<SavedPlan> {
  if (!draft || typeof draft !== 'object') {
    return { ok: false, error: { code: 'invalid_plan', message: 'A saved Plan needs documents and plan items.' } }
  }
  const body = draft as SavedPlanDraft
  const plans = readLog(userDataDir).plans
  const existing = body.id ? plans.find((plan) => plan.id === body.id) ?? null : null
  if (body.id && !existing) {
    return { ok: false, error: { code: 'invalid_plan', message: 'Saved Plan not found.' } }
  }
  const next = planFromDraft(body, new Date().toISOString(), existing)
  if ('code' in next) return { ok: false, error: next }
  const rest = plans.filter((plan) => plan.id !== next.id)
  writeLog(userDataDir, [next, ...rest])
  return { ok: true, data: next }
}

export function deleteSavedPlan(
  userDataDir: string,
  planId: unknown,
): PlanStoreResult<SavedPlan[]> {
  if (typeof planId !== 'string' || !planId.trim()) {
    return { ok: false, error: { code: 'invalid_plan', message: 'Saved Plan not found.' } }
  }
  const plans = readLog(userDataDir).plans
  if (!plans.some((plan) => plan.id === planId)) {
    return { ok: false, error: { code: 'invalid_plan', message: 'Saved Plan not found.' } }
  }
  const next = plans.filter((plan) => plan.id !== planId)
  writeLog(userDataDir, next)
  return { ok: true, data: next }
}

export function duplicateSavedPlanRecord(
  userDataDir: string,
  planId: unknown,
): PlanStoreResult<SavedPlan> {
  if (typeof planId !== 'string' || !planId.trim()) {
    return { ok: false, error: { code: 'invalid_plan', message: 'Saved Plan not found.' } }
  }
  const plans = readLog(userDataDir).plans
  const current = plans.find((plan) => plan.id === planId)
  if (!current) return { ok: false, error: { code: 'invalid_plan', message: 'Saved Plan not found.' } }
  const copy = duplicateSavedPlan(current, new Date().toISOString())
  writeLog(userDataDir, [copy, ...plans])
  return { ok: true, data: copy }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function runPlanLibraryChecks(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'suhuella-plans-'))
  const sample = path.join(root, 'invoice.pdf')
  writeFileSync(sample, 'invoice')
  try {
    assert(listSavedPlans(root).length === 0, 'empty userData has no saved plans')
    const saved = saveSavedPlan(root, {
      title: 'Move invoices',
      knowledgeSet: { items: [{ path: sample, kind: 'file' }] },
      items: [
        {
          action: 'move',
          currentPath: sample,
          proposedPath: path.join(root, 'Clients', 'invoice.pdf'),
          explanation: 'Invoice',
          status: 'preview',
          warnings: [],
          reviewGroup: 'ready',
          selected: true,
          fileName: 'invoice.pdf',
          score: null,
          confidenceLabel: null,
          alternatives: [],
          skipReason: null,
        },
      ],
    })
    assert(saved.ok, 'plan record saves')
    if (!saved.ok) return
    const copy = duplicateSavedPlanRecord(root, saved.data.id)
    assert(copy.ok && copy.data.id !== saved.data.id, 'duplicate writes a second record')
    const removed = deleteSavedPlan(root, saved.data.id)
    assert(removed.ok && removed.data.length === 1, 'delete removes the plan record')
    assert(existsSync(sample), 'delete plan leaves the file in place')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
