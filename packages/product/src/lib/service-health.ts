import { brand } from '@suhuella/brand'

export const SERVICE_STATES = ['NORMAL', 'DEGRADED', 'WEB_CAPACITY_LIMITED'] as const
export type ServiceState = (typeof SERVICE_STATES)[number]

export const SERVICE_CAPABILITIES = [
  'license-check',
  'license-activation',
  'license-recovery',
  'checkout',
  'business-branding',
  'release-manifest',
  'remote-analysis',
  'connectors',
] as const
export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number]

export type PublicServiceHealth = {
  serviceState: ServiceState
  affectedCapabilities: ServiceCapability[]
  retryAfter: number | null
}

export const NORMAL_SERVICE_HEALTH: PublicServiceHealth = {
  serviceState: 'NORMAL',
  affectedCapabilities: [],
  retryAfter: null,
}

export function isServiceCapabilityLimited(
  health: PublicServiceHealth | null | undefined,
  capability: ServiceCapability,
): boolean {
  if (!health || health.serviceState === 'NORMAL') return false
  return health.affectedCapabilities.includes(capability)
}

export function serviceHealthCopy(
  health: PublicServiceHealth,
  host: 'browser' | 'electron',
): { title: string; body: string; hint: string | null } {
  if (health.serviceState === 'WEB_CAPACITY_LIMITED') {
    return {
      title: `${brand.displayName} Web is temporarily at capacity`,
      body: 'To keep the service responsive, new browser sessions are temporarily limited.',
      hint: host === 'browser' ? `You can continue in the ${brand.displayName} desktop app.` : 'Your local files are unaffected.',
    }
  }
  return {
    title: `${brand.displayName} Web is busier than usual`,
    body: 'Some online functions are temporarily unavailable. Your local files are unaffected.',
    hint: host === 'browser' ? `You can continue working in the ${brand.displayName} desktop app.` : null,
  }
}

export function parseServiceHealth(value: unknown): PublicServiceHealth | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const serviceState = record.serviceState
  if (serviceState !== 'NORMAL' && serviceState !== 'DEGRADED' && serviceState !== 'WEB_CAPACITY_LIMITED') {
    return null
  }
  const affected = Array.isArray(record.affectedCapabilities)
    ? record.affectedCapabilities.filter((item): item is ServiceCapability =>
        typeof item === 'string' && (SERVICE_CAPABILITIES as readonly string[]).includes(item),
      )
    : []
  return {
    serviceState,
    affectedCapabilities: affected,
    retryAfter: typeof record.retryAfter === 'number' && Number.isFinite(record.retryAfter) ? record.retryAfter : null,
  }
}

export async function fetchPublicServiceHealth(baseUrl = ''): Promise<PublicServiceHealth> {
  try {
    const response = await fetch(`${baseUrl}/api/service-health`, { cache: 'no-store' })
    if (!response.ok) return NORMAL_SERVICE_HEALTH
    const parsed = parseServiceHealth(await response.json())
    return parsed ?? NORMAL_SERVICE_HEALTH
  } catch {
    return NORMAL_SERVICE_HEALTH
  }
}
