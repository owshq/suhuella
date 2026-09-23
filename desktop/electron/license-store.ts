import { siteOrigin } from '@suhuella/brand'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { validateSignedLicensePayload } from '@suhuella/product/lib/signed-license-contract.ts'
import { toLicenseStatusView } from '@suhuella/product/lib/license-status.ts'
import type { LicenseContext, LicenseEdition, LicenseStatusView } from '@suhuella/product/types.ts'
import { getOsComputerName } from './device-identity.ts'
import { verifyLicenseSignature } from './license-signature-verify.ts'

export { verifyLicenseSignature } from './license-signature-verify.ts'

const LICENSE_FILE = 'license.json'
const DEVICE_FILE = 'device.json'
const FREE_CAPABILITIES = [
  'recommend_folder',
  'explain_recommendation',
  'navigate_save_dialog',
  'copy_path',
  'open_folder',
  'refresh_index',
]

type CachedDevice = {
  deviceId: string
  name: string
  platform: string
  lastSeen: string
  current: boolean
}

type LicenseRecord = {
  context: LicenseContext
  lastSeenOffline?: boolean
  deviceCache?: CachedDevice[]
  customDeviceName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function licenseFilePath(): string {
  return path.join(app.getPath('userData'), LICENSE_FILE)
}

function deviceFilePath(): string {
  return path.join(app.getPath('userData'), DEVICE_FILE)
}

export function getDeviceId(): string {
  const filePath = deviceFilePath()
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { deviceId?: string }
      if (parsed.deviceId?.trim()) return parsed.deviceId
    } catch {
      // regenerate
    }
  }
  const deviceId = randomUUID()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify({ deviceId }, null, 2)}\n`, 'utf8')
  return deviceId
}

function defaultDeviceName(): string {
  return getOsComputerName()
}

export function getDeviceName(): string {
  const record = existsSync(licenseFilePath()) ? readRecord() : null
  return record?.customDeviceName?.trim() || defaultDeviceName()
}

export function setDeviceName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return getDeviceName()
  const record = readRecord()
  writeRecord({ ...record, customDeviceName: trimmed })
  return trimmed
}

function isEdition(value: unknown): value is LicenseEdition {
  return (
    value === 'free' ||
    value === 'personal_lifetime' ||
    value === 'personal_monthly' ||
    value === 'business' ||
    value === 'enterprise'
  )
}

function parseMemberRole(value: unknown): LicenseContext['memberRole'] | undefined {
  if (value === 'owner' || value === 'admin' || value === 'member') return value
  return undefined
}

function parseLicenseContext(value: unknown): LicenseContext | null {
  if (!isRecord(value) || !isEdition(value.edition)) return null
  if (typeof value.licenseId !== 'string' || typeof value.customerId !== 'string') return null
  if (typeof value.status !== 'string') return null
  return {
    licenseId: value.licenseId,
    customerId: value.customerId,
    email: typeof value.email === 'string' ? value.email : '',
    edition: value.edition,
    status: value.status === 'expired' || value.status === 'revoked' ? value.status : 'active',
    capabilities: Array.isArray(value.capabilities)
      ? value.capabilities.filter((item): item is string => typeof item === 'string')
      : [...FREE_CAPABILITIES],
    enabledKnowledgeSources: Array.isArray(value.enabledKnowledgeSources)
      ? value.enabledKnowledgeSources.filter((item): item is string => typeof item === 'string')
      : ['local_folder'],
    deviceLimit: typeof value.deviceLimit === 'number' ? value.deviceLimit : 1,
    activatedDevices: typeof value.activatedDevices === 'number' ? value.activatedDevices : 1,
    organisationId: typeof value.organisationId === 'string' ? value.organisationId : undefined,
    organisationName: typeof value.organisationName === 'string' ? value.organisationName : undefined,
    organisationLogo: typeof value.organisationLogo === 'string' ? value.organisationLogo : null,
    seatId: typeof value.seatId === 'string' ? value.seatId : undefined,
    memberRole: parseMemberRole(value.memberRole),
    validUntil: typeof value.validUntil === 'string' ? value.validUntil : null,
    lastCheckedAt: typeof value.lastCheckedAt === 'string' ? value.lastCheckedAt : new Date().toISOString(),
    offlineUntil:
      typeof value.offlineUntil === 'string' ? value.offlineUntil : new Date().toISOString(),
    channel: value.channel === 'beta' ? 'beta' : 'stable',
    licenseToken: typeof value.licenseToken === 'string' ? value.licenseToken : '',
    commercialGenerationId:
      value.commercialGenerationId === null
        ? null
        : typeof value.commercialGenerationId === 'string'
          ? value.commercialGenerationId
          : undefined,
    generationAccessMode:
      value.generationAccessMode === 'legacy_unassigned' ||
      value.generationAccessMode === 'purchased_generation' ||
      value.generationAccessMode === 'active_subscription' ||
      value.generationAccessMode === 'version_binding_required'
        ? value.generationAccessMode
        : undefined,
    acquiredCommercialGenerationIds: Array.isArray(value.acquiredCommercialGenerationIds)
      ? value.acquiredCommercialGenerationIds.filter((item): item is string => typeof item === 'string')
      : undefined,
    generationEnforcementActive:
      value.generationEnforcementActive === true ? true : undefined,
    policyRevision:
      value.policyRevision === null
        ? null
        : typeof value.policyRevision === 'string'
          ? value.policyRevision
          : undefined,
    signedContractVersion:
      typeof value.signedContractVersion === 'number' ? value.signedContractVersion : undefined,
  }
}

function parseCachedDevice(value: unknown): CachedDevice | null {
  if (!isRecord(value) || typeof value.deviceId !== 'string') return null
  return {
    deviceId: value.deviceId,
    name: typeof value.name === 'string' ? value.name : 'Unknown device',
    platform: typeof value.platform === 'string' ? value.platform : '',
    lastSeen: typeof value.lastSeen === 'string' ? value.lastSeen : new Date().toISOString(),
    current: value.current === true,
  }
}

function parseLicenseRecord(value: unknown): LicenseRecord | null {
  if (!isRecord(value)) return null
  if (isRecord(value.context)) {
    const context = parseLicenseContext(value.context)
    if (!context) return null
    const deviceCache = Array.isArray(value.deviceCache)
      ? value.deviceCache
          .map((item) => parseCachedDevice(item))
          .filter((item): item is CachedDevice => item != null)
      : undefined
    return {
      context,
      lastSeenOffline: value.lastSeenOffline === true,
      deviceCache,
      customDeviceName:
        typeof value.customDeviceName === 'string' ? value.customDeviceName : undefined,
    }
  }
  const context = parseLicenseContext(value)
  if (!context) return null
  return { context, lastSeenOffline: false }
}

export function createFreeLicenseContext(): LicenseContext {
  const now = new Date().toISOString()
  return {
    licenseId: 'lic_free_local',
    customerId: 'cust_local',
    email: '',
    edition: 'free',
    status: 'active',
    capabilities: [...FREE_CAPABILITIES],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil: '9999-12-31T23:59:59.000Z',
    channel: 'stable',
    licenseToken: 'local',
  }
}

function writeRecord(record: LicenseRecord): LicenseRecord {
  const filePath = licenseFilePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return record
}

function readRecord(): LicenseRecord {
  const filePath = licenseFilePath()
  if (!existsSync(filePath)) {
    return writeRecord({ context: createFreeLicenseContext(), lastSeenOffline: false })
  }
  try {
    const parsed = parseLicenseRecord(JSON.parse(readFileSync(filePath, 'utf8')))
    if (!parsed) return writeRecord({ context: createFreeLicenseContext(), lastSeenOffline: false })
    if (parsed.context.edition !== 'free' && !verifyLicenseSignature(parsed.context)) {
      return writeRecord({ context: createFreeLicenseContext(), lastSeenOffline: false })
    }
    if (
      parsed.context.edition !== 'free' &&
      !validateSignedLicensePayload(parsed.context).ok
    ) {
      return writeRecord({ context: createFreeLicenseContext(), lastSeenOffline: false })
    }
    return parsed
  } catch {
    return writeRecord({ context: createFreeLicenseContext(), lastSeenOffline: false })
  }
}

export type ApiDevice = {
  deviceId: string
  name: string
  platform: string
  lastSeen: string
  current: boolean
}

export function saveLicenseContext(
  context: LicenseContext,
  extras: { lastSeenOffline?: boolean; devices?: ApiDevice[] } = {},
): LicenseContext {
  if (
    context.edition !== 'free' &&
    context.licenseToken !== 'local' &&
    (!verifyLicenseSignature(context) || !validateSignedLicensePayload(context).ok)
  ) {
    return loadLicenseContext()
  }
  const previous: LicenseRecord = existsSync(licenseFilePath())
    ? readRecord()
    : { context: createFreeLicenseContext(), lastSeenOffline: false }
  writeRecord({
    context,
    lastSeenOffline: extras.lastSeenOffline ?? previous.lastSeenOffline ?? false,
    deviceCache: extras.devices ?? previous.deviceCache,
    customDeviceName: previous.customDeviceName,
  })
  return context
}

export function loadLicenseContext(): LicenseContext {
  return readRecord().context
}

export function clearLicenseContext(): LicenseContext {
  const previous = readRecord()
  return writeRecord({
    context: createFreeLicenseContext(),
    lastSeenOffline: false,
    customDeviceName: previous.customDeviceName,
  }).context
}

export function getCachedDeviceId(index: number): string | null {
  const cache = readRecord().deviceCache ?? []
  return cache[index]?.deviceId ?? null
}

export function licenseView(
  context: LicenseContext = loadLicenseContext(),
  extras: {
    lastSeenOffline?: boolean
    learningOk?: boolean
    saveAsActive?: boolean
  } = {},
): LicenseStatusView {
  const record = readRecord()
  const lastSeenOffline = extras.lastSeenOffline ?? record.lastSeenOffline ?? false
  const devices = (record.deviceCache ?? []).map(({ deviceId: _id, ...device }) => device)
  return toLicenseStatusView(context, {
    lastSeenOffline,
    computerName: getDeviceName(),
    devices,
    learningOk: extras.learningOk,
    saveAsActive: extras.saveAsActive,
  })
}

export function licenseApiBaseUrl(): string {
  const configured = process.env.SUHUELLA_LICENSE_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (process.env.VITE_DEV_SERVER_URL) return 'http://localhost:3000'
  return siteOrigin()
}
