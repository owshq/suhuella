import { brand } from '@suhuella/brand'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAppLocale } from '../lib/app-locale'
import { productCopy } from '../lib/product-copy'
import { checkoutReturnFromLocation } from '../lib/app-routes'
import { getSuhuellaApi } from '../lib/api'
import {
  checkoutPath,
  licensePlanCards,
  unavailablePlanMessage,
  type CheckoutPlan,
  type LicensePlanCard,
} from '../lib/license-checkout'
import { ACTIVATION_ATTEMPT_STORAGE_KEY } from '../lib/license-plans'
import {
  activationSuccessMessage,
  licenseErrorMessage,
  offlineNote,
} from '../lib/license-status'
import { isServiceCapabilityLimited, NORMAL_SERVICE_HEALTH, type PublicServiceHealth } from '../lib/service-health'
import type { LicenseApiError, LicenseStatusView } from '../types'

const SUPPORT_EMAIL = brand.supportEmail

type LicenseStatusPanelProps = {
  compact?: boolean
  onOpenLicense?: () => void
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
      {children}
    </div>
  )
}

function QuietCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.6rem] border border-white/60 bg-white/45 p-5 backdrop-blur-xl">{children}</div>
  )
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-[var(--brand-accent)] px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-600 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

async function openExternal(url: string) {
  const api = getSuhuellaApi()
  if (typeof api.openExternal === 'function') {
    await api.openExternal(url)
    return
  }
  window.open(url)
}

function isPaidPlan(id: LicensePlanCard['id']): id is CheckoutPlan {
  return id === 'lifetime' || id === 'monthly' || id === 'business'
}

function currentHeadline(license: LicenseStatusView | null): string {
  if (!license || license.kind === 'free') return `You are using ${brand.displayName} Free`
  return license.headline
}

function currentDetail(license: LicenseStatusView | null): string {
  if (!license || license.kind === 'free') {
    return 'Everything stays on this device. No account needed.'
  }
  return license.detail
}

function StatusRows({ license }: { license: LicenseStatusView }) {
  const isBusiness = license.kind === 'business'
  const showDevices = license.deviceCount != null && license.deviceLimit != null
  const showDetails =
    license.kind !== 'free' &&
    (isBusiness || Boolean(license.organisationName || license.email || showDevices))

  if (!showDetails) return null

  return (
    <dl className="mt-4 grid gap-2 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm">
      {license.organisationName ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Organisation</dt>
          <dd className="font-semibold text-slate-900">{license.organisationName}</dd>
        </div>
      ) : null}
      {license.email ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">{isBusiness ? 'Signed in as' : 'Email'}</dt>
          <dd className="min-w-0 truncate font-semibold text-slate-900">{license.email}</dd>
        </div>
      ) : null}
      {showDevices ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">{isBusiness ? 'Devices' : 'Your devices'}</dt>
          <dd className="font-semibold text-slate-900">
            {license.deviceCount} of {license.deviceLimit}
          </dd>
        </div>
      ) : null}
      {license.periodEndLabel ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Current period</dt>
          <dd className="font-semibold text-slate-900">{license.periodEndLabel}</dd>
        </div>
      ) : null}
    </dl>
  )
}

export function LicenseStatusPanel({
  compact = false,
  onOpenLicense,
}: LicenseStatusPanelProps) {
  const { t } = useAppLocale()
  const [license, setLicense] = useState<LicenseStatusView | null>(null)
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [codeMessage, setCodeMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [showSupportInfo, setShowSupportInfo] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [deviceLimitReached, setDeviceLimitReached] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [renamingDevice, setRenamingDevice] = useState(false)
  const [platform, setPlatform] = useState('')
  const [purchaseState, setPurchaseState] = useState<
    'idle' | 'confirmed' | 'activating' | 'active' | 'canceled' | 'unavailable'
  >('idle')
  const [unavailablePlan, setUnavailablePlan] = useState('')
  const handledSession = useRef('')
  const [serviceHealth, setServiceHealth] = useState<PublicServiceHealth>(NORMAL_SERVICE_HEALTH)
  const checkoutLimited = isServiceCapabilityLimited(serviceHealth, 'checkout')
  const recoveryLimited = isServiceCapabilityLimited(serviceHealth, 'license-recovery')

  useEffect(() => {
    const api = getSuhuellaApi()
    if (typeof api.getServiceHealth !== 'function') return
    void api.getServiceHealth().then(setServiceHealth).catch(() => setServiceHealth(NORMAL_SERVICE_HEALTH))
  }, [])

  useEffect(() => {
    void getSuhuellaApi()
      .getLicense()
      .then(setLicense)
      .catch(() => setLicense(null))

    void getSuhuellaApi()
      .getAppInfo()
      .then((info) => setPlatform(info.platform))
      .catch(() => undefined)

    if (compact) return undefined

    function applyCheckoutReturn() {
      const returned = checkoutReturnFromLocation(window.location)
      if (returned.checkout === 'canceled') setPurchaseState('canceled')
      else if (returned.checkout === 'unavailable') {
        setPurchaseState('unavailable')
        setUnavailablePlan(returned.plan)
      }

      if (!returned.sessionId) {
        void getSuhuellaApi()
          .checkLicense()
          .then((result) => {
            if (result.ok) setLicense(result.license)
            else if (result.license) setLicense(result.license)
          })
          .catch(() => undefined)
        return
      }
      if (handledSession.current === returned.sessionId) return
      handledSession.current = returned.sessionId

      setPurchaseState('confirmed')
      setBusy(true)
      const activationAttemptId =
        typeof sessionStorage !== 'undefined'
          ? sessionStorage.getItem(ACTIVATION_ATTEMPT_STORAGE_KEY) ?? undefined
          : undefined
      void getSuhuellaApi()
        .activateFromCheckout(returned.sessionId, activationAttemptId)
        .then((result) => {
          if (result.ok && typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(ACTIVATION_ATTEMPT_STORAGE_KEY)
          }
          if (result.license) setLicense(result.license)
          if (result.ok) {
            setDeviceLimitReached(false)
            setPurchaseState('active')
            setFeedback({ tone: 'ok', text: 'Personal · Active' })
            return
          }
          setDeviceLimitReached(result.error === 'device_limit')
          setPurchaseState('idle')
          setFeedback({ tone: 'error', text: licenseErrorMessage(result.error) })
        })
        .catch(() => setFeedback({ tone: 'error', text: licenseErrorMessage('server_error') }))
        .finally(() => setBusy(false))
    }

    applyCheckoutReturn()
    window.addEventListener('hashchange', applyCheckoutReturn)
    window.addEventListener('popstate', applyCheckoutReturn)
    return () => {
      window.removeEventListener('hashchange', applyCheckoutReturn)
      window.removeEventListener('popstate', applyCheckoutReturn)
    }
  }, [compact])

  function applyResult(
    result: { ok: true; license: LicenseStatusView } | { ok: false; error: LicenseApiError; license?: LicenseStatusView },
    successText?: string,
  ) {
    if (result.license) setLicense(result.license)
    if (result.ok) {
      setDeviceLimitReached(false)
      setFeedback(successText ? { tone: 'ok', text: successText } : null)
      return
    }
    setDeviceLimitReached(result.error === 'device_limit')
    setFeedback({ tone: 'error', text: licenseErrorMessage(result.error) })
  }

  function run(action: () => Promise<Parameters<typeof applyResult>[0]>, successText?: string) {
    setBusy(true)
    setFeedback(null)
    void action()
      .then((result) => applyResult(result, successText))
      .catch(() => setFeedback({ tone: 'error', text: licenseErrorMessage('server_error') }))
      .finally(() => setBusy(false))
  }

  const kind = license?.kind ?? 'free'
  const plans = licensePlanCards(kind)

  async function buyPlan(plan: CheckoutPlan) {
    if (checkoutLimited) {
      setFeedback({
        tone: 'error',
        text: licenseErrorMessage('service_unavailable'),
      })
      return
    }
    const api = getSuhuellaApi()
    let activationAttemptId: string | undefined
    if (typeof api.createCheckoutAttempt === 'function') {
      const attempt = await api.createCheckoutAttempt(plan)
      if (attempt.ok) {
        activationAttemptId = attempt.activationAttemptId
        sessionStorage.setItem(ACTIVATION_ATTEMPT_STORAGE_KEY, activationAttemptId)
      }
    }
    if (typeof api.openCheckout === 'function') {
      await api.openCheckout(plan, email)
      return
    }
    const path = checkoutPath(plan, {
      email,
      platform,
      activationAttemptId,
      returnTo: window.__suhuellaHost === 'browser' ? 'settings' : 'desktop',
    })
    if (window.__suhuellaHost === 'browser') {
      window.location.assign(path)
      return
    }
    await openExternal(path)
  }

  async function sendVerificationCode() {
    if (recoveryLimited) {
      setFeedback({
        tone: 'error',
        text: licenseErrorMessage('service_unavailable'),
      })
      return
    }
    const trimmed = email.trim()
    if (!trimmed) return
    setBusy(true)
    setFeedback(null)
    setCodeMessage(null)
    try {
      const result = await getSuhuellaApi().requestLicenseEmailCode(trimmed)
      if (!result.ok) {
        setFeedback({ tone: 'error', text: licenseErrorMessage(result.error as LicenseApiError) })
        return
      }
      setChallengeId(result.challengeId)
      setCodeMessage(result.message)
      setVerificationCode('')
    } catch {
      setFeedback({ tone: 'error', text: licenseErrorMessage('server_error') })
    } finally {
      setBusy(false)
    }
  }

  async function activateWithVerificationCode() {
    if (!challengeId || !verificationCode.trim()) return
    setBusy(true)
    setFeedback(null)
    try {
      const verified = await getSuhuellaApi().verifyLicenseEmailCode(
        challengeId,
        verificationCode.trim(),
      )
      if (!verified.ok) {
        setFeedback({ tone: 'error', text: licenseErrorMessage(verified.error as LicenseApiError) })
        return
      }
      const result = await getSuhuellaApi().activateLicense(verified.proofId)
      applyResult(result, activationSuccessMessage())
      if (result.ok) {
        setChallengeId('')
        setVerificationCode('')
        setCodeMessage(null)
      }
    } catch {
      setFeedback({ tone: 'error', text: licenseErrorMessage('server_error') })
    } finally {
      setBusy(false)
    }
  }

  if (compact) {
    return (
      <Card>
        <h2 className="text-base font-semibold text-slate-900">{currentHeadline(license)}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{currentDetail(license)}</p>
        {license?.workingOffline ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{offlineNote()}</p>
        ) : null}
        {onOpenLicense ? (
          <div className="mt-4">
            <SecondaryButton onClick={onOpenLicense}>
              {kind === 'free' ? 'Activate existing license' : 'Open your license'}
            </SecondaryButton>
          </div>
        ) : null}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-slate-900">{currentHeadline(license)}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{currentDetail(license)}</p>
        {license?.workingOffline ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{offlineNote()}</p>
        ) : null}
        {purchaseState === 'canceled' ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Checkout canceled. Your plan is unchanged.
          </p>
        ) : null}
        {purchaseState === 'unavailable' ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {unavailablePlanMessage(unavailablePlan)}
          </p>
        ) : null}
        {purchaseState === 'confirmed' || purchaseState === 'activating' ? (
          <p className="mt-3 text-sm font-medium text-slate-700">
            Purchase confirmed. Activating this device…
          </p>
        ) : null}
        {purchaseState === 'active' ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">Personal · Active</p>
        ) : null}
        {license ? <StatusRows license={license} /> : null}

        {kind !== 'free' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {kind === 'personal_lifetime' || kind === 'personal_monthly' ? (
              <SecondaryButton onClick={() => setShowDevices((value) => !value)}>
                Manage devices
              </SecondaryButton>
            ) : null}
            {kind === 'personal_lifetime' ? (
              <SecondaryButton onClick={() => setShowSupportInfo((value) => !value)}>
                View support info
              </SecondaryButton>
            ) : null}
            {kind === 'personal_monthly' || kind === 'business' || kind === 'needs_attention' ? (
              <SecondaryButton disabled={busy} onClick={() => run(() => getSuhuellaApi().checkLicense())}>
                {busy ? 'Refreshing…' : 'Refresh license'}
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
      </Card>

      {kind === 'business' && license ? (
        <Card>
          <h3 className="text-base font-semibold text-slate-900">Business logo</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Replaces the {brand.displayName} mark in the app shell for this organisation. About still says {brand.displayName}.
          </p>
          {license.canEditBranding ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Change logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const dataUrl = typeof reader.result === 'string' ? reader.result : null
                      if (!dataUrl) return
                      run(() => getSuhuellaApi().updateBusinessBranding(dataUrl), 'Business logo updated')
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
              <SecondaryButton
                disabled={busy || !license.organisationLogo}
                onClick={() =>
                  run(() => getSuhuellaApi().updateBusinessBranding(null), `${brand.displayName} logo restored`)
                }
              >
                Restore {brand.displayName} logo
              </SecondaryButton>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Only the Business owner can change this logo.</p>
          )}
        </Card>
      ) : null}

      <Card>
        <h3 className="text-base font-semibold text-slate-900">Choose a plan</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Buying opens a secure checkout in your browser. It does not activate an existing license.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => {
            const paidId = isPaidPlan(plan.id) ? plan.id : null
            return (
            <div
              key={plan.id}
              className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4"
            >
              <p className="text-sm font-semibold text-slate-900">{plan.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{plan.summary}</p>
              <div className="mt-3">
                {plan.current ? (
                  <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Current plan
                  </span>
                ) : plan.cta && paidId ? (
                  <SecondaryButton onClick={() => void buyPlan(paidId)}>
                    {plan.cta}
                  </SecondaryButton>
                ) : null}
              </div>
            </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-slate-900">Already purchased?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Enter your purchase email. We send a 6-digit code to verify ownership before activating this device.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--brand-accent)]"
              placeholder="you@company.com"
            />
          </label>
          <SecondaryButton disabled={busy || !email.trim()} onClick={() => void sendVerificationCode()}>
            {busy && !challengeId ? 'Sending…' : 'Send code'}
          </SecondaryButton>
          {codeMessage ? <p className="text-sm text-slate-600">{codeMessage}</p> : null}
          {challengeId ? (
            <>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Verification code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm tracking-[0.35em] text-slate-900 outline-none focus:border-[var(--brand-accent)]"
                  placeholder="123456"
                />
              </label>
              <PrimaryButton
                disabled={busy || verificationCode.trim().length !== 6}
                onClick={() => void activateWithVerificationCode()}
              >
                {busy ? 'Activating…' : 'Activate license'}
              </PrimaryButton>
            </>
          ) : null}
        </div>
        {feedback ? (
          <p className={`mt-3 text-sm ${feedback.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {feedback.text}
          </p>
        ) : null}
      </Card>

      {showDevices && license ? (
        <QuietCard>
          <p className="text-sm font-semibold text-slate-900">Your devices</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {(license.devices.length > 0
              ? license.devices
              : [
                  {
                    index: 0,
                    name: license.computerName,
                    platform: '',
                    lastSeenLabel: license.lastCheckedLabel,
                    current: true,
                  },
                ]
            ).map((device) => (
              <li key={`${device.index}-${device.name}`} className="rounded-xl px-2 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{device.name}</span>
                  {device.current ? (
                    <span className="text-slate-500">This computer</span>
                  ) : (
                    <SecondaryButton
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => getSuhuellaApi().deactivateRemoteDevice(device.index),
                          'Device removed from your license',
                        )
                      }
                    >
                      Deactivate device
                    </SecondaryButton>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Last seen {device.lastSeenLabel.toLowerCase()}</p>
              </li>
            ))}
          </ul>
          {renamingDevice ? (
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                setRenamingDevice(false)
                run(() => getSuhuellaApi().renameThisDevice(deviceName), 'Computer name updated')
              }}
            >
              <input
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--brand-accent)]"
                placeholder={license.computerName}
              />
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={busy || !deviceName.trim()} onClick={() => {
                  setRenamingDevice(false)
                  run(() => getSuhuellaApi().renameThisDevice(deviceName), 'Computer name updated')
                }}>
                  Save name
                </PrimaryButton>
                <SecondaryButton disabled={busy} onClick={() => setRenamingDevice(false)}>Cancel</SecondaryButton>
              </div>
            </form>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton
                onClick={() => {
                  setDeviceName(license.computerName)
                  setRenamingDevice(true)
                }}
              >
                Rename this computer
              </SecondaryButton>
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  run(
                    () => getSuhuellaApi().deactivateLicense(),
                    'This computer is now using Free edition',
                  )
                }
              >
                Remove this computer
              </SecondaryButton>
            </div>
          )}
        </QuietCard>
      ) : null}

      {showSupportInfo && license ? (
        <QuietCard>
          <dl className="grid gap-2 text-sm">
            {license.email ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Email</dt>
                <dd className="min-w-0 truncate font-semibold text-slate-900">{license.email}</dd>
              </div>
            ) : null}
            {license.supportCode ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Support code</dt>
                <dd className="font-semibold text-slate-900">{license.supportCode}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Support</dt>
              <dd className="font-semibold text-slate-900">{SUPPORT_EMAIL}</dd>
            </div>
          </dl>
        </QuietCard>
      ) : null}

      {kind !== 'free' && license ? (
        <QuietCard>
          <h3 className="text-sm font-semibold text-slate-900">{t.revokeTitle}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{t.revokeBody}</p>
          <div className="mt-3">
            <SecondaryButton
              disabled={busy}
              onClick={() =>
                run(
                  () => getSuhuellaApi().deactivateLicense(),
                  t.revokeDone,
                )
              }
            >
              {t.revokeAction}
            </SecondaryButton>
          </div>
        </QuietCard>
      ) : null}

      {deviceLimitReached ? (
        <QuietCard>
          <h3 className="text-sm font-semibold text-slate-900">
            This Personal license allows 3 devices.
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {productCopy('Deactivate another computer, then activate this one. SuHuella will not remove a device for you.')}
          </p>
        </QuietCard>
      ) : null}
    </div>
  )
}
