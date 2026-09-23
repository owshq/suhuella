import { brand } from '@suhuella/brand'

/** Lifetime personal: one active device. Disconnect to activate another. */
export const PERSONAL_DEVICE_LIMIT = 1
/** Monthly personal: up to three active devices. */
export const MONTHLY_DEVICE_LIMIT = 3
/** Business default per assigned seat (superadmin may override per organisation). */
export const BUSINESS_DEVICE_LIMIT = 3

export type CheckoutPlan = 'lifetime' | 'monthly' | 'business'
export type CheckoutReturnTo = 'settings' | 'desktop' | 'public'
export type CommercialPlanId = CheckoutPlan | 'free'
export type LicenseCopyLocale = 'en' | 'es'

export type LicensePlanCard = {
  id: CommercialPlanId
  title: string
  /** Billing, validity, and device limit — one line. */
  summary: string
  /** Product capabilities implemented for this edition. */
  features: string[]
  cta: string | null
  current: boolean
}

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return value === 'lifetime' || value === 'monthly' || value === 'business'
}

export function isCheckoutReturnTo(value: string): value is CheckoutReturnTo {
  return value === 'settings' || value === 'desktop' || value === 'public'
}

function deviceLimitLabel(limit: number, locale: LicenseCopyLocale): string {
  if (locale === 'es') {
    return limit === 1 ? 'Un dispositivo activo' : `${limit} dispositivos activos`
  }
  return limit === 1 ? 'One active device' : `${limit} active devices`
}

export function personalDeviceLimitLabel(locale: LicenseCopyLocale = 'en'): string {
  return deviceLimitLabel(PERSONAL_DEVICE_LIMIT, locale)
}

export function monthlyDeviceLimitLabel(locale: LicenseCopyLocale = 'en'): string {
  return deviceLimitLabel(MONTHLY_DEVICE_LIMIT, locale)
}

export function businessDeviceLimitLabel(locale: LicenseCopyLocale = 'en'): string {
  return deviceLimitLabel(BUSINESS_DEVICE_LIMIT, locale)
}

type PlanCopy = {
  title: string
  summary: string
  features: string[]
  cta: string | null
}

export function planFeaturesFor(id: CommercialPlanId, locale: LicenseCopyLocale): string[] {
  if (locale === 'es') {
    switch (id) {
      case 'free':
        return [
          'Carpetas locales en este dispositivo',
          'Buscar y revisar planes de organización',
          'Sugerencias de carpeta al guardar (donde esté disponible)',
          'Sin cuenta ni pago',
        ]
      case 'lifetime':
        return [
          'Todo lo de Gratis, más confirmar organización (mover, renombrar, crear carpetas)',
          'Fuentes cloud: Google Drive, Dropbox y OneDrive',
          'Pago único — sin caducidad por suscripción',
          'Un dispositivo activo (desactiva el otro para cambiar)',
        ]
      case 'monthly':
        return [
          'Todo lo de Lifetime, más Gmail y Outlook como fuentes',
          'Suscripción mensual — vigente mientras esté activa',
          `${MONTHLY_DEVICE_LIMIT} dispositivos activos (desactiva uno para cambiar)`,
        ]
      case 'business':
        return [
          'Licencia por plaza para tu equipo',
          'Admin de organización: plazas y asignación',
          'Logo propio en la app (el About sigue mostrando SuHuella)',
          'Fuentes cloud y correo (como Monthly)',
          `${BUSINESS_DEVICE_LIMIT} dispositivos activos por plaza asignada`,
        ]
    }
  }

  switch (id) {
    case 'free':
      return [
        'Local folders on this device',
        'Search and review organisation plans',
        'Save As folder suggestions (where available)',
        'No account or payment',
      ]
    case 'lifetime':
      return [
        'Everything in Free, plus confirm organisation (move, rename, create folders)',
        'Cloud sources: Google Drive, Dropbox, and OneDrive',
        'One-time payment — no subscription expiry',
        'One active device (deactivate the other to switch)',
      ]
    case 'monthly':
      return [
        'Everything in Lifetime, plus Gmail and Outlook sources',
        'Monthly subscription — active while subscribed',
        `${MONTHLY_DEVICE_LIMIT} active devices (deactivate one to switch)`,
      ]
    case 'business':
      return [
        'Per-seat license for your team',
        'Organisation admin: seats and assignment',
        'Your logo in the app shell (About still shows SuHuella)',
        'Cloud and mail sources (same as Monthly)',
        `${BUSINESS_DEVICE_LIMIT} active devices per assigned seat`,
      ]
  }
}

function planCopyFor(
  id: CommercialPlanId,
  locale: LicenseCopyLocale,
  surface: 'settings' | 'public',
): PlanCopy {
  if (locale === 'es') {
    switch (id) {
      case 'free':
        return {
          title: 'Gratis',
          summary: 'Todo permanece en tu dispositivo. Sin cuenta.',
          features: planFeaturesFor(id, locale),
          cta: surface === 'public' ? `Abrir ${brand.displayName}` : null,
        }
      case 'lifetime':
        return {
          title: 'Personal Lifetime',
          summary: `Pago único. Uso personal. ${personalDeviceLimitLabel(locale)}. Sin caducidad por suscripción.`,
          features: planFeaturesFor(id, locale),
          cta: 'Comprar',
        }
      case 'monthly':
        return {
          title: 'Personal Monthly',
          summary: `Suscripción mensual. Uso personal. ${monthlyDeviceLimitLabel(locale)}. Vigente mientras la suscripción esté activa.`,
          features: planFeaturesFor(id, locale),
          cta: 'Suscribirse',
        }
      case 'business':
        return {
          title: 'Business',
          summary: `Suscripción por plazas. ${businessDeviceLimitLabel(locale)} por plaza asignada. Administra tu organización.`,
          features: planFeaturesFor(id, locale),
          cta: 'Contratar Business',
        }
    }
  }

  switch (id) {
    case 'free':
      return {
        title: 'Free',
        summary: 'Everything stays on your device. No account needed.',
        features: planFeaturesFor(id, locale),
        cta: surface === 'public' ? `Open ${brand.displayName}` : null,
      }
    case 'lifetime':
      return {
        title: 'Personal Lifetime',
        summary: `One-time purchase. Personal use. ${personalDeviceLimitLabel(locale)}. No subscription expiry.`,
        features: planFeaturesFor(id, locale),
        cta: 'Buy once',
      }
    case 'monthly':
      return {
        title: 'Personal Monthly',
        summary: `Monthly subscription. Personal use. ${monthlyDeviceLimitLabel(locale)}. Active while subscribed.`,
        features: planFeaturesFor(id, locale),
        cta: 'Subscribe',
      }
    case 'business':
      return {
        title: 'Business',
        summary: `Per-seat subscription. ${businessDeviceLimitLabel(locale)} per assigned seat. Organisation admin.`,
        features: planFeaturesFor(id, locale),
        cta: 'Get Business',
      }
  }
}

export function commercialPlanCards(
  kind = 'free',
  surface: 'settings' | 'public' = 'settings',
  locale: LicenseCopyLocale = 'en',
): LicensePlanCard[] {
  const ids: CommercialPlanId[] = ['free', 'lifetime', 'monthly', 'business']
  return ids.map((id) => {
    const copy = planCopyFor(id, locale, surface)
    return {
      id,
      title: copy.title,
      summary: copy.summary,
      features: copy.features,
      cta: copy.cta,
      current:
        surface === 'settings' &&
        ((id === 'free' && kind === 'free') ||
          (id === 'lifetime' && kind === 'personal_lifetime') ||
          (id === 'monthly' && kind === 'personal_monthly') ||
          (id === 'business' && kind === 'business')),
    }
  })
}

export type LicenseJourneyStep = {
  id: string
  title: string
  detail: string
}

export function licenseJourneySteps(locale: LicenseCopyLocale = 'en'): LicenseJourneyStep[] {
  if (locale === 'es') {
    return [
      {
        id: 'access',
        title: 'Abrir o descargar',
        detail: `Usa ${brand.displayName} en el navegador o descarga el instalador. No requiere pago.`,
      },
      {
        id: 'payment',
        title: 'Pago verificado',
        detail: 'Los planes de pago usan Stripe Checkout. El pago no activa el dispositivo por sí solo.',
      },
      {
        id: 'identity',
        title: 'Identidad verificada',
        detail: 'Confirmamos tu email con un código de 6 dígitos antes de activar.',
      },
      {
        id: 'activation',
        title: 'Activación del dispositivo',
        detail: 'La licencia se vincula a este ordenador. Personal: un dispositivo activo a la vez.',
      },
      {
        id: 'rights',
        title: 'Derechos de uso',
        detail: 'Dependen del plan (Gratis, Lifetime, Monthly o Business). Monthly caduca si termina la suscripción; Lifetime no.',
      },
    ]
  }
  return [
    {
      id: 'access',
      title: 'Open or download',
      detail: `Use ${brand.displayName} in the browser or download the installer. No payment required.`,
    },
    {
      id: 'payment',
      title: 'Verified payment',
      detail: 'Paid plans use Stripe Checkout. Payment alone does not activate this device.',
    },
    {
      id: 'identity',
      title: 'Verified identity',
      detail: 'We confirm your email with a 6-digit code before activation.',
    },
    {
      id: 'activation',
      title: 'Device activation',
      detail: 'Your license links to this computer. Personal plans: one active device at a time.',
    },
    {
      id: 'rights',
      title: 'Usage rights',
      detail: 'Depend on your plan (Free, Lifetime, Monthly, or Business). Monthly ends if the subscription ends; Lifetime does not.',
    },
  ]
}

export function activateDeviceCopy(locale: LicenseCopyLocale = 'en'): {
  title: string
  intro: string
  emailLabel: string
  sendCode: string
  codeLabel: string
  activate: string
} {
  if (locale === 'es') {
    return {
      title: 'Activar este dispositivo',
      intro:
        '¿Ya compraste? Introduce aquí el email de esa compra. Te enviamos un código de 6 dígitos para activar este dispositivo — aparte del checkout de Stripe de arriba.',
      emailLabel: 'Email de la compra',
      sendCode: 'Enviar código',
      codeLabel: 'Código de verificación',
      activate: 'Activar licencia',
    }
  }
  return {
    title: 'Activate this device',
    intro:
      'Already purchased? Enter that purchase email here. We send a 6-digit code to activate this device — separate from Stripe checkout above.',
    emailLabel: 'Purchase email',
    sendCode: 'Send code',
    codeLabel: 'Verification code',
    activate: 'Activate license',
  }
}

export function unavailablePlanMessage(plan?: string): string {
  if (plan === 'lifetime') return 'Lifetime is not available yet.'
  if (plan === 'monthly') return 'Monthly is not available yet.'
  return 'This plan is not available yet.'
}

/** CTA label when public paid checkout is off. */
export function paidPlanUnavailableCta(locale: LicenseCopyLocale = 'en'): string {
  return locale === 'es' ? 'Aún no disponible' : 'Not available yet'
}

/** Accessible explanation that paid checkout is closed. */
export function paidCheckoutClosedMessage(locale: LicenseCopyLocale = 'en'): string {
  return locale === 'es'
    ? 'El checkout de planes de pago está cerrado. Lifetime, Monthly y Business aún no están disponibles.'
    : 'Paid plan checkout is closed. Lifetime, Monthly, and Business are not available yet.'
}

/**
 * Browser shell sets `__suhuellaPaidCheckoutEnabled` from PAID_CHECKOUT_ENABLED.
 * Explicit false/true wins. Missing on Electron allows the CTA (Worker still gates).
 * Missing on web means closed.
 */
type PaidCheckoutRuntime = {
  __suhuellaPaidCheckoutEnabled?: boolean
  __suhuellaHost?: string
}

function paidCheckoutRuntime(): PaidCheckoutRuntime | undefined {
  if (typeof globalThis === 'undefined' || !('window' in globalThis)) return undefined
  return (globalThis as { window?: PaidCheckoutRuntime }).window
}

export function readPaidCheckoutEnabled(
  flag: boolean | undefined = paidCheckoutRuntime()?.__suhuellaPaidCheckoutEnabled,
): boolean {
  if (flag === true) return true
  if (flag === false) return false
  return paidCheckoutRuntime()?.__suhuellaHost === 'electron'
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
