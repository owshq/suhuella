import { brand } from '@suhuella/brand'

/** Personal licenses allow one active device. Disconnect that device to activate another. */
export const PERSONAL_DEVICE_LIMIT = 1

export type CheckoutPlan = 'lifetime' | 'monthly' | 'business'
export type CheckoutReturnTo = 'settings' | 'desktop' | 'public'
export type CommercialPlanId = CheckoutPlan | 'free'

export type LicensePlanCard = {
  id: CommercialPlanId
  title: string
  summary: string
  cta: string | null
  current: boolean
}

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return value === 'lifetime' || value === 'monthly' || value === 'business'
}

export function isCheckoutReturnTo(value: string): value is CheckoutReturnTo {
  return value === 'settings' || value === 'desktop' || value === 'public'
}

export function personalDeviceLimitLabel(): string {
  return PERSONAL_DEVICE_LIMIT === 1 ? '1 device' : `${PERSONAL_DEVICE_LIMIT} devices`
}

export function commercialPlanCards(
  kind = 'free',
  surface: 'settings' | 'public' = 'settings',
): LicensePlanCard[] {
  const devices = `One device.`
  return [
    {
      id: 'free',
      title: 'Free',
      summary: 'Everything stays on your device. No account needed.',
      cta: surface === 'public' ? `Open ${brand.displayName}` : null,
      current: surface === 'settings' && kind === 'free',
    },
    {
      id: 'lifetime',
      title: 'Personal Lifetime',
      summary: `One-time payment. Personal use. ${devices}`,
      cta: 'Buy once',
      current: kind === 'personal_lifetime',
    },
    {
      id: 'monthly',
      title: 'Personal Monthly',
      summary: `Monthly subscription. Personal use. ${devices}`,
      cta: 'Subscribe',
      current: kind === 'personal_monthly',
    },
    {
      id: 'business',
      title: 'Business',
      summary: 'Team seats. Managed organisation.',
      cta: 'Contact sales',
      current: kind === 'business',
    },
  ]
}

export function unavailablePlanMessage(plan?: string): string {
  if (plan === 'lifetime') return 'Lifetime is not available yet.'
  if (plan === 'monthly') return 'Monthly is not available yet.'
  return 'This plan is not available yet.'
}

/** CTA label when public paid checkout is off. */
export function paidPlanUnavailableCta(locale: 'es' | 'en' = 'en'): string {
  return locale === 'es' ? 'Aún no disponible' : 'Not available yet'
}

/** Accessible explanation that paid checkout is closed. */
export function paidCheckoutClosedMessage(locale: 'es' | 'en' = 'en'): string {
  return locale === 'es'
    ? 'El checkout de planes de pago está cerrado. Lifetime y Monthly aún no están disponibles.'
    : 'Paid plan checkout is closed. Lifetime and Monthly are not available yet.'
}

/**
 * Browser shell sets `__suhuellaPaidCheckoutEnabled` from PAID_CHECKOUT_ENABLED.
 * Explicit false/true wins. Missing on Electron allows the CTA (Worker still gates).
 * Missing on web means closed.
 */
export function readPaidCheckoutEnabled(
  flag: boolean | undefined = typeof window !== 'undefined'
    ? window.__suhuellaPaidCheckoutEnabled
    : undefined,
): boolean {
  if (flag === true) return true
  if (flag === false) return false
  return typeof window !== 'undefined' && window.__suhuellaHost === 'electron'
}

export function checkoutPath(
  plan: CheckoutPlan,
  options: {
    email?: string
    platform?: string
    returnTo?: CheckoutReturnTo
    activationAttemptId?: string
  } = {},
): string {
  const params = new URLSearchParams()
  if (options.email?.trim()) params.set('email', options.email.trim())
  if (options.platform?.trim()) params.set('platform', options.platform.trim())
  if (options.returnTo) params.set('return', options.returnTo)
  if (options.activationAttemptId?.trim()) params.set('attempt', options.activationAttemptId.trim())
  const query = params.toString()
  return query ? `/checkout/${plan}?${query}` : `/checkout/${plan}`
}

export const ACTIVATION_ATTEMPT_STORAGE_KEY = 'suhuella_activation_attempt_id'
