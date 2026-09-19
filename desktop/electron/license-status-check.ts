import { resolveEffectiveBranding } from '../src/lib/effective-branding.ts'
import { checkoutPath, licensePlanCards, unavailablePlanMessage } from '../src/lib/license-checkout.ts'
import { licenseErrorMessage, toLicenseStatusView } from '../src/lib/license-status.ts'
import type { LicenseContext } from '../src/types.ts'

function context(partial: Partial<LicenseContext>): LicenseContext {
  return {
    licenseId: 'lic_test',
    customerId: 'cust_hidden',
    email: 'ada@example.com',
    edition: 'free',
    status: 'active',
    capabilities: [],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 3,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: '2026-09-18T00:00:00.000Z',
    offlineUntil: '2026-12-01T00:00:00.000Z',
    channel: 'stable',
    licenseToken: 'hidden',
    ...partial,
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const free = toLicenseStatusView(context({ edition: 'free', email: '' }))
assert(free.kind === 'free', 'free kind')
assert(free.headline === 'Free', 'free headline')
assert(free.detail === 'Everything stays on this device. No account needed.', 'free detail')
assert(free.productState === 'activation_required', 'free activation required')
assert(free.identityTitle.startsWith('SuHuella ·'), 'free identity uses Brand display name')
assert(free.supportCode === null, 'free has no support code')
assert(free.health.length === 4, 'health checklist')
assert(free.organisationLogo === null, 'free has no business logo')
assert(free.canEditBranding === false, 'free cannot edit branding')
assert(resolveEffectiveBranding('data:image/png;base64,xx') === 'data:image/png;base64,xx', 'png branding accepted')
assert(resolveEffectiveBranding('data:image/svg+xml;base64,xx') === null, 'svg branding rejected')

const lifetime = toLicenseStatusView(
  context({ edition: 'personal_lifetime' }),
  { computerName: 'MacBook Pro', devices: [{ name: 'MacBook Pro', platform: 'darwin', lastSeen: '2026-09-18T00:00:00.000Z', current: true }] },
)
assert(lifetime.headline === 'Personal Lifetime', 'lifetime headline')
assert(lifetime.detail === 'Activated', 'lifetime detail')
assert(lifetime.editionLabel === 'Personal Lifetime', 'lifetime edition label')
assert(lifetime.devices[0]?.current === true, 'lifetime current device')
assert(lifetime.identityTitle.includes('MacBook Pro'), 'lifetime identity computer')
assert(lifetime.productState === 'ready', 'lifetime ready')

const monthly = toLicenseStatusView(context({ edition: 'personal_monthly' }))
assert(monthly.headline === 'Personal Monthly', 'monthly headline')

const business = toLicenseStatusView(
  context({ edition: 'business', organisationName: 'Acme', memberRole: 'member' }),
  { computerName: 'MacBook Pro' },
)
assert(business.headline === 'Business', 'business headline')
assert(business.detail === 'Managed by Acme', 'business detail')
assert(business.organisationName === 'Acme', 'business organisation')
assert(business.roleLabel === 'Member', 'business role')
assert(business.canEditBranding === false, 'member cannot edit branding')
assert(business.identityTitle.startsWith('Acme · Business'), 'business identity org first')
const businessOwner = toLicenseStatusView(
  context({ edition: 'business', organisationName: 'Acme', memberRole: 'owner', organisationLogo: 'data:image/png;base64,xx' }),
)
assert(businessOwner.canEditBranding === true, 'owner can edit branding')
assert(businessOwner.organisationLogo === 'data:image/png;base64,xx', 'owner sees configured logo')
assert(!JSON.stringify(business).includes('cust_hidden'), 'no customer id')
assert(!JSON.stringify(business).includes('hidden'), 'no token')

const expired = toLicenseStatusView(context({ edition: 'personal_monthly', status: 'expired' }))
assert(expired.kind === 'needs_attention', 'expired kind')
assert(expired.headline === 'Your subscription has ended.', 'expired headline')
assert(expired.productState === 'expired', 'expired product state')

const revoked = toLicenseStatusView(context({ edition: 'business', status: 'revoked' }))
assert(revoked.needsAttention, 'revoked needs attention')

const offline = toLicenseStatusView(context({ edition: 'personal_lifetime' }), {
  lastSeenOffline: true,
})
assert(offline.workingOffline, 'offline working')
assert(offline.productState === 'offline', 'offline product state')
assert(offline.kind === 'personal_lifetime', 'offline stays calm')

const monthlyUntil = toLicenseStatusView(
  context({ edition: 'personal_monthly', validUntil: '2026-10-18T00:00:00.000Z' }),
)
assert(monthlyUntil.detail.includes('Active until'), 'monthly period copy')
assert(monthlyUntil.periodEndLabel !== null, 'monthly period label')

const cards = licensePlanCards('free')
assert(cards[0]?.current === true, 'free is current')
assert(cards.some((card) => card.cta === 'Buy once'), 'lifetime buy once')
assert(cards.some((card) => card.cta === 'Subscribe'), 'monthly subscribe')
assert(cards.some((card) => card.cta === 'Contact sales'), 'business contact sales')
assert(cards.some((card) => card.summary.includes('3 devices')), 'personal device limit')
assert(!cards.some((card) => card.cta === 'Upgrade'), 'no generic upgrade')
assert(!cards.some((card) => String(card.id) === 'partner_annual' || card.title.toLowerCase().includes('partner')), 'partner license is not an end-customer plan card')
assert(checkoutPath('lifetime') === '/checkout/lifetime', 'lifetime CTA resolves lifetime checkout')
assert(checkoutPath('monthly') === '/checkout/monthly', 'monthly CTA resolves monthly checkout')
assert(checkoutPath('business') === '/checkout/business', 'business CTA resolves business contact path')
assert(
  checkoutPath('monthly', { returnTo: 'settings' }).includes('return=settings'),
  'settings checkout returns to License',
)
assert(unavailablePlanMessage('lifetime') === 'Lifetime is not available yet.', 'lifetime unavailable is truthful')
assert(unavailablePlanMessage('monthly') === 'Monthly is not available yet.', 'monthly unavailable is truthful')
assert(!unavailablePlanMessage('lifetime').toLowerCase().includes('monthly'), 'lifetime copy is not monthly')
assert(!unavailablePlanMessage('monthly').toLowerCase().includes('lifetime'), 'monthly copy is not lifetime')

assert(licenseErrorMessage('no_license') === 'No active license was found for this email.', 'no license copy')
assert(licenseErrorMessage('unknown_email') === 'No active license was found for this email.', 'unknown email copy')
assert(
  licenseErrorMessage('device_limit').includes('3 devices'),
  'device limit copy',
)
assert(
  licenseErrorMessage('revoked') === 'This complimentary license is no longer active.',
  'revoked gift copy',
)
assert(
  licenseErrorMessage('expired') === 'This subscription is no longer active.',
  'expired monthly copy',
)
assert(
  licenseErrorMessage('invalid_code') === 'That code is incorrect. Try again or request a new one.',
  'otp invalid code is not a subscription error',
)
assert(
  licenseErrorMessage('invalid_proof') === 'That verification expired. Request a new code and try again.',
  'expired otp proof is not a subscription error',
)
assert(
  licenseErrorMessage('server_error').includes("couldn't update"),
  'server error copy',
)

console.log('license-status checks passed')
