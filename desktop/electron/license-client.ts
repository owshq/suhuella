import { app, shell } from 'electron'
import { checkoutPath, type CheckoutPlan } from '@suhuella/product/lib/license-checkout.ts'
import {
  clearLicenseContext,
  getCachedDeviceId,
  getDeviceId,
  getDeviceName,
  licenseApiBaseUrl,
  licenseView,
  loadLicenseContext,
  saveLicenseContext,
  setDeviceName,
  type ApiDevice,
} from './license-store.ts'
import type {
  BusinessOrganisationAction,
  BusinessOrganisationResult,
  LicenseActionResult,
  LicenseApiError,
  LicenseContext,
} from '@suhuella/product/types.ts'
import { fetchPublicServiceHealth, type PublicServiceHealth } from '@suhuella/product/lib/service-health.ts'

type ApiSuccess = { ok: true; license: LicenseContext; devices?: ApiDevice[] }
type ApiFailure = { ok: false; error: LicenseApiError; devices?: ApiDevice[] }

function publicDevicesFromApi(devices: ApiDevice[] | undefined) {
  return (devices ?? []).map((device, index) => ({
    index,
    name: device.name,
    platform: device.platform,
    lastSeenLabel: device.lastSeen,
    current: device.current,
  }))
}

async function postLicense(
  pathName: string,
  body: Record<string, string>,
): Promise<ApiSuccess | ApiFailure> {
  try {
    const response = await fetch(`${licenseApiBaseUrl()}${pathName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    let data: ApiSuccess | ApiFailure | null = null
    try {
      data = (await response.json()) as ApiSuccess | ApiFailure
    } catch {
      if (response.status === 429) return { ok: false, error: 'rate_limited' }
      if (response.status === 503) return { ok: false, error: 'service_unavailable' }
      return { ok: false, error: response.status >= 500 ? 'server_error' : 'offline' }
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'server_error' }
    }
    if (!data.ok && response.status === 503) return { ok: false, error: 'service_unavailable' }
    if (!data.ok && response.status === 429) return { ok: false, error: data.error === 'rate_limited' ? 'rate_limited' : data.error }
    return data
  } catch {
    return { ok: false, error: 'offline' }
  }
}

export function getServiceHealth(): Promise<PublicServiceHealth> {
  return fetchPublicServiceHealth(licenseApiBaseUrl())
}

function viewFromContext(
  context: LicenseContext,
  options: { lastSeenOffline?: boolean; devices?: ApiDevice[] } = {},
) {
  saveLicenseContext(context, options)
  return licenseView(context, { lastSeenOffline: options.lastSeenOffline })
}

export function getLicenseView() {
  return licenseView()
}

export async function createCheckoutAttempt(plan: CheckoutPlan): Promise<
  { ok: true; activationAttemptId: string } | { ok: false; error: LicenseApiError }
> {
  const result = await postLicense('/api/license/checkout-attempt', {
    deviceId: getDeviceId(),
    plan,
  })
  if (!result.ok) return result
  const activationAttemptId = (result as ApiSuccess & { activationAttemptId?: string }).activationAttemptId
  if (!activationAttemptId) return { ok: false, error: 'server_error' }
  return { ok: true, activationAttemptId }
}

export async function requestLicenseEmailCode(email: string): Promise<
  | { ok: true; challengeId: string; message: string }
  | { ok: false; error: LicenseApiError }
> {
  const response = await postLicense('/api/license/email-code/request', {
    email,
    purpose: 'LICENSE_ACTIVATION',
    deviceId: getDeviceId(),
  })
  if (!response.ok) return response
  const body = response as ApiSuccess & { challengeId?: string; message?: string }
  if (!body.challengeId) return { ok: false, error: 'server_error' }
  return { ok: true, challengeId: body.challengeId, message: body.message ?? '' }
}

export async function verifyLicenseEmailCode(
  challengeId: string,
  code: string,
): Promise<{ ok: true; proofId: string } | { ok: false; error: LicenseApiError }> {
  const response = await postLicense('/api/license/email-code/verify', { challengeId, code })
  if (!response.ok) return response
  const body = response as ApiSuccess & { proofId?: string }
  if (!body.proofId) return { ok: false, error: 'server_error' }
  return { ok: true, proofId: body.proofId }
}

export async function activateFromCheckout(
  sessionId: string,
  activationAttemptId?: string,
): Promise<LicenseActionResult> {
  const result = await postLicense('/api/license/activate-from-checkout', {
    sessionId,
    ...(activationAttemptId?.trim() ? { activationAttemptId: activationAttemptId.trim() } : {}),
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    platform: process.platform,
    appVersion: app.getVersion(),
  })
  if (!result.ok) {
    return { ...result, license: licenseView(), devices: publicDevicesFromApi(result.devices) }
  }
  return {
    ok: true,
    license: viewFromContext(result.license, {
      lastSeenOffline: false,
      devices: result.devices,
    }),
  }
}

export async function updateBusinessBranding(dataUrl: string | null): Promise<LicenseActionResult> {
  const current = loadLicenseContext()
  if (current.edition !== 'business' || !current.organisationId || !current.email) {
    return { ok: false, error: 'invalid_request', license: licenseView(current) }
  }
  try {
    const response = await fetch(`${licenseApiBaseUrl()}/api/business/branding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organisationId: current.organisationId,
        email: current.email,
        dataUrl,
      }),
    })
    const data = (await response.json()) as { ok: boolean; error?: string }
    if (!data.ok) {
      return {
        ok: false,
        error: data.error === 'forbidden' || data.error === 'invalid_branding_asset' ? 'invalid_request' : 'server_error',
        license: licenseView(current),
      }
    }
    return checkLicense()
  } catch {
    return { ok: false, error: 'offline', license: licenseView(current) }
  }
}

async function postOrganisation(
  body: Record<string, string | number>,
): Promise<BusinessOrganisationResult> {
  const current = loadLicenseContext()
  if (current.edition !== 'business' && current.edition !== 'enterprise') {
    return { ok: false, error: 'forbidden' }
  }
  try {
    const response = await fetch(`${licenseApiBaseUrl()}/api/license/organisation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        licenseToken: current.licenseToken,
        ...body,
      }),
    })
    const data = (await response.json()) as BusinessOrganisationResult
    if (!data || typeof data !== 'object') return { ok: false, error: 'server_error' }
    return data
  } catch {
    return { ok: false, error: 'offline' }
  }
}

export async function getBusinessOrganisation(): Promise<BusinessOrganisationResult> {
  return postOrganisation({})
}

export async function manageBusinessOrganisation(
  action: BusinessOrganisationAction,
  payload: { email?: string; seatId?: string; seatCount?: number } = {},
): Promise<BusinessOrganisationResult> {
  return postOrganisation({
    action,
    email: payload.email ?? '',
    seatId: payload.seatId ?? '',
    ...(payload.seatCount != null ? { seatCount: payload.seatCount } : {}),
  })
}

export async function activateLicense(emailProofId: string): Promise<LicenseActionResult> {
  const result = await postLicense('/api/license/activate', {
    emailProofId,
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    platform: process.platform,
    appVersion: app.getVersion(),
  })
  if (!result.ok) {
    return { ...result, license: licenseView(), devices: publicDevicesFromApi(result.devices) }
  }
  return {
    ok: true,
    license: viewFromContext(result.license, {
      lastSeenOffline: false,
      devices: result.devices,
    }),
  }
}

export async function checkLicense(silent = false): Promise<LicenseActionResult> {
  const current = loadLicenseContext()
  if (current.edition === 'free') {
    return { ok: true, license: licenseView(current, { lastSeenOffline: false }) }
  }

  const result = await postLicense('/api/license/check', {
    deviceId: getDeviceId(),
    licenseToken: current.licenseToken,
    deviceName: getDeviceName(),
  })

  if (!result.ok) {
    if (result.error === 'offline' || result.error === 'service_unavailable' || result.error === 'rate_limited' || result.error === 'server_error') {
      return {
        ok: true,
        license: viewFromContext(current, { lastSeenOffline: true }),
      }
    }
    if (result.error === 'expired' || result.error === 'revoked') {
      return {
        ok: true,
        license: viewFromContext(
          { ...current, status: result.error === 'expired' ? 'expired' : 'revoked' },
          { lastSeenOffline: false },
        ),
      }
    }
    if (result.error === 'not_activated') {
      return { ok: true, license: licenseView(clearLicenseContext()) }
    }
    if (silent) {
      return { ok: true, license: licenseView(current) }
    }
    return { ...result, license: licenseView(current), devices: publicDevicesFromApi(result.devices) }
  }

  return {
    ok: true,
    license: viewFromContext(result.license, {
      lastSeenOffline: false,
      devices: result.devices,
    }),
  }
}

export async function deactivateLicense(): Promise<LicenseActionResult> {
  const current = loadLicenseContext()
  if (current.edition === 'free') {
    return { ok: true, license: licenseView(current) }
  }
  const result = await postLicense('/api/license/deactivate', {
    deviceId: getDeviceId(),
    licenseToken: current.licenseToken,
  })
  if (!result.ok && result.error !== 'not_activated' && result.error !== 'offline') {
    return { ...result, license: licenseView(current), devices: publicDevicesFromApi(result.devices) }
  }
  return { ok: true, license: licenseView(clearLicenseContext()) }
}

export async function deactivateRemoteDevice(deviceIndex: number): Promise<LicenseActionResult> {
  const current = loadLicenseContext()
  if (current.edition === 'free') {
    return { ok: true, license: licenseView(current) }
  }
  const targetDeviceId = getCachedDeviceId(deviceIndex)
  if (!targetDeviceId) {
    return { ok: false, error: 'invalid_request', license: licenseView(current) }
  }
  const result = await postLicense('/api/license/deactivate', {
    deviceId: getDeviceId(),
    licenseToken: current.licenseToken,
    targetDeviceId,
  })
  if (!result.ok) {
    return { ...result, license: licenseView(current), devices: publicDevicesFromApi(result.devices) }
  }
  const refreshed = await checkLicense(true)
  return refreshed
}

export async function renameThisDevice(name: string): Promise<LicenseActionResult> {
  setDeviceName(name)
  return checkLicense()
}

export function silentLicenseRefresh(): void {
  void checkLicense(true).catch(() => undefined)
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export async function openExternalUrl(url: string): Promise<boolean> {
  const resolved = url.startsWith('/') ? `${licenseApiBaseUrl()}${url}` : url
  if (!isSafeExternalUrl(resolved)) return false
  if (resolved.startsWith('http:') && !resolved.startsWith('http://localhost')) return false
  await shell.openExternal(resolved)
  return true
}

export async function openCheckout(
  plan: CheckoutPlan,
  email = '',
  activationAttemptId = '',
): Promise<boolean> {
  const pathName = checkoutPath(plan, {
    ...(email.trim() ? { email: email.trim() } : {}),
    platform: process.platform,
    returnTo: 'desktop',
    ...(activationAttemptId.trim() ? { activationAttemptId: activationAttemptId.trim() } : {}),
  })
  return openExternalUrl(pathName)
}
