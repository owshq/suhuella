import { brand } from '@suhuella/brand'

export const PERSONAL_DEVICE_LIMIT = 3

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

export function commercialPlanCards(
  kind = 'free',
  surface: 'settings' | 'public' = 'settings',
): LicensePlanCard[] {
  const devices = `Up to ${PERSONAL_DEVICE_LIMIT} devices.`
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
