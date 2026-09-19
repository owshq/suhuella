import { brand } from '@suhuella/brand'
import { PERSONAL_DEVICE_LIMIT } from './license-plans.ts'
import type {
  LicenseApiError,
  LicenseContext,
  LicenseDeviceInfo,
  LicenseHealthItem,
  LicenseProductState,
  LicenseStatusKind,
  LicenseStatusView,
} from '../types.ts'

const OFFLINE_NOTE = `${brand.displayName} can keep working offline for a limited time.`

export function licenseErrorMessage(error: LicenseApiError): string {
  if (error === 'unknown_email' || error === 'no_license') {
    return 'No active license was found for this email.'
  }
  if (error === 'device_limit') {
    return `This Personal license allows ${PERSONAL_DEVICE_LIMIT} devices. Deactivate another computer, then activate this one.`
  }
  if (error === 'payment_incomplete') return 'Payment was not completed.'
  if (error === 'revoked') return 'This complimentary license is no longer active.'
  if (error === 'expired') return 'This subscription is no longer active.'
  if (error === 'not_activated') return 'This computer is not on your license'
  if (error === 'email_verification_required') {
    return 'Verify your purchase email with the code we send you, then activate again.'
  }
  if (error === 'invalid_proof' || error === 'invalid_attempt') {
    return 'That verification expired. Request a new code and try again.'
  }
  if (error === 'invalid_code') {
    return 'That code is incorrect. Try again or request a new one.'
  }
  if (error === 'rate_limited') return 'Too many attempts. Wait a few minutes, then try again.'
  if (error === 'service_unavailable') {
    return 'Some online functions are temporarily unavailable. Your local files are unaffected.'
  }
  if (error === 'offline') return OFFLINE_NOTE
  return "We couldn't update your license. Try again later or contact support."
}

export function activationSuccessMessage(): string {
  return 'License active'
}

export function identityLicenseLine(license: {
  needsAttention?: boolean
  kind?: string
  editionLabel?: string
} | null): string {
  if (!license) return 'Checking license…'
  if (license.needsAttention) return 'License needs attention'
  if (license.kind === 'free') return 'Free · Activate license'
  if (license.kind === 'personal_lifetime') return 'Personal Lifetime · Activated'
  if (license.kind === 'personal_monthly') return 'Personal Monthly · Activated'
  if (license.kind === 'business') return 'Business · Managed by organisation'
  return license.editionLabel?.trim() || 'License'
}

function formatPeriodDate(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRelativeDay(iso: string, now: number): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

function editionLabelFor(edition: LicenseContext['edition']): string {
  if (edition === 'personal_lifetime') return 'Personal Lifetime'
  if (edition === 'personal_monthly') return 'Personal Monthly'
  if (edition === 'enterprise') return 'Enterprise'
  if (edition === 'business') return 'Business'
  return 'Free'
}

function roleLabelFor(role: LicenseContext['memberRole']): string | null {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Administrator'
  if (role === 'member') return 'Member'
  return null
}

function headlineFor(kind: LicenseStatusKind, edition: LicenseContext['edition']): string {
  if (kind === 'needs_attention') {
    return edition === 'personal_monthly' ? 'Your subscription has ended.' : 'License needs attention'
  }
  if (kind === 'personal_lifetime') return 'Personal Lifetime'
  if (kind === 'personal_monthly') return 'Personal Monthly'
  if (kind === 'business') {
    return edition === 'enterprise' ? 'Enterprise' : 'Business'
  }
  return 'Free'
}

function detailFor(
  context: LicenseContext,
  kind: LicenseStatusKind,
  needsAttention: boolean,
): string {
  if (kind === 'needs_attention' || needsAttention) {
    if (context.status === 'revoked') return 'This complimentary license is no longer active.'
    if (context.edition === 'personal_monthly' || context.status === 'expired') {
      return 'Reactivate to continue using paid features.'
    }
    return 'Refresh your license or contact support.'
  }
  if (context.edition === 'free') return 'Everything stays on this device. No account needed.'
  if (context.edition === 'personal_lifetime') return 'Activated'
  if (context.edition === 'personal_monthly' && context.validUntil) {
    return `Active until ${formatPeriodDate(context.validUntil)}`
  }
  if (context.edition === 'business' || context.edition === 'enterprise') {
    return context.organisationName
      ? `Managed by ${context.organisationName}`
      : 'Managed by your organisation'
  }
  return 'This computer is using your license.'
}

function kindFor(context: LicenseContext, needsAttention: boolean): LicenseStatusKind {
  if (needsAttention) return 'needs_attention'
  if (context.edition === 'personal_lifetime') return 'personal_lifetime'
  if (context.edition === 'personal_monthly') return 'personal_monthly'
  if (context.edition === 'business' || context.edition === 'enterprise') return 'business'
  return 'free'
}

function graceHasEnded(context: LicenseContext, now: number): boolean {
  if (context.edition === 'free') return false
  const offlineUntil = Date.parse(context.offlineUntil)
  return Number.isFinite(offlineUntil) && offlineUntil < now
}

function productStateFor(
  context: LicenseContext,
  options: { needsAttention: boolean; workingOffline: boolean; paid: boolean },
): LicenseProductState {
  if (options.needsAttention) {
    return context.status === 'expired' || graceHasEnded(context, Date.now())
      ? 'expired'
      : 'needs_attention'
  }
  if (!options.paid) return 'activation_required'
  if (options.workingOffline) return 'offline'
  return 'ready'
}

function identityTitleFor(
  context: LicenseContext,
  options: {
    editionLabel: string
    roleLabel: string | null
    computerName: string
    productState: LicenseProductState
  },
): string {
  if (options.productState === 'needs_attention' || options.productState === 'expired') {
    return 'License needs attention'
  }
  if (context.organisationName) {
    const role = options.roleLabel ? ` · ${options.roleLabel}` : ''
    return `${context.organisationName} · ${options.editionLabel}${role} · ${options.computerName} · Ready`
  }
  if (context.edition === 'free') {
    return `${brand.displayName} · ${options.computerName}`
  }
  return `${options.editionLabel} · ${options.computerName} · Ready`
}

function buildHealth(options: {
  saveAsActive: boolean
  learningOk: boolean
  licenceOk: boolean
}): LicenseHealthItem[] {
  return [
    {
      id: 'save_as',
      label: 'Save As Assistant',
      status: options.saveAsActive ? 'ok' : 'unknown',
    },
    {
      id: 'learning',
      label: 'Learning',
      status: options.learningOk ? 'ok' : 'attention',
    },
    {
      id: 'licence',
      label: 'License',
      status: options.licenceOk ? 'ok' : 'attention',
    },
    {
      id: 'updates',
      label: 'Updates',
      status: 'ok',
    },
  ]
}

export function toLicenseStatusView(
  context: LicenseContext,
  options: {
    lastSeenOffline?: boolean
    computerName?: string
    devices?: Array<{ name: string; platform: string; lastSeen: string; current: boolean }>
    learningOk?: boolean
    saveAsActive?: boolean
    now?: number
  } = {},
): LicenseStatusView {
  const now = options.now ?? Date.now()
  const paid = context.edition !== 'free'
  const expired = context.status === 'expired' || context.status === 'revoked'
  const needsAttention = paid && (expired || graceHasEnded(context, now))
  const workingOffline = Boolean(paid && options.lastSeenOffline && !needsAttention)
  const kind = kindFor(context, needsAttention)
  const editionLabel = editionLabelFor(context.edition)
  const roleLabel = roleLabelFor(context.memberRole)
  const computerName = options.computerName?.trim() || 'This computer'
  const productState = productStateFor(context, { needsAttention, workingOffline, paid })
  const identityTitle = identityTitleFor(context, {
    editionLabel,
    roleLabel,
    computerName,
    productState,
  })

  const devices: LicenseDeviceInfo[] = (options.devices ?? []).map((device, index) => ({
    index,
    name: device.name,
    platform: device.platform,
    lastSeenLabel: formatRelativeDay(device.lastSeen, now),
    current: device.current,
  }))

  if (paid && devices.length === 0) {
    devices.push({
      index: 0,
      name: computerName,
      platform: '',
      lastSeenLabel: formatRelativeDay(context.lastCheckedAt, now),
      current: true,
    })
  }

  const lastCheckedLabel = formatRelativeDay(context.lastCheckedAt, now)
  const offlineUntilLabel =
    paid && context.offlineUntil
      ? formatRelativeDay(context.offlineUntil, now)
      : null

  return {
    kind,
    productState,
    identityTitle,
    editionLabel,
    roleLabel,
    computerName,
    headline: headlineFor(kind, context.edition),
    detail: detailFor(context, kind, needsAttention),
    email: paid || needsAttention ? context.email : '',
    organisationName:
      kind === 'business' || (needsAttention && Boolean(context.organisationName))
        ? context.organisationName ?? null
        : null,
    organisationId: kind === 'business' ? context.organisationId ?? null : null,
    organisationLogo:
      kind === 'business' && context.status === 'active' ? context.organisationLogo ?? null : null,
    canEditBranding:
      kind === 'business' && context.memberRole === 'owner' && !needsAttention && context.status === 'active',
    deviceCount: paid ? context.activatedDevices : null,
    deviceLimit: paid ? context.deviceLimit : null,
    devices,
    workingOffline,
    needsAttention,
    lastCheckedLabel,
    offlineUntilLabel,
    periodEndLabel:
      context.edition === 'personal_monthly' && context.validUntil
        ? formatPeriodDate(context.validUntil)
        : null,
    supportCode: paid ? context.licenseId : null,
    health: buildHealth({
      saveAsActive: options.saveAsActive ?? false,
      learningOk: options.learningOk ?? true,
      licenceOk: !needsAttention,
    }),
  }
}

export function offlineNote(): string {
  return OFFLINE_NOTE
}
