import assert from 'node:assert/strict'
import {
  deriveProductBrandView,
  EFFECTIVE_BRAND_IDENTITY_VERSION,
  resolveEffectiveBrandIdentity,
} from '../src/lib/effective-brand-identity.ts'

const base = resolveEffectiveBrandIdentity()
assert.equal(base.identityVersion, EFFECTIVE_BRAND_IDENTITY_VERSION, 'identity version is 1')
assert.equal(base.wordmark.length > 0, true, 'product wordmark exists')
assert.equal(base.accentColor.length > 0, true, 'product accent exists')
assert.equal(base.privacyUrl?.includes('/privacy'), true, 'privacy stays product-owned')
assert.equal(base.termsUrl?.includes('/terms'), true, 'terms stay product-owned')

const businessLogo = resolveEffectiveBrandIdentity({
  logo: 'data:image/png;base64,abc',
  accentColor: null,
  supportEmail: null,
})
assert.equal(businessLogo.logo, 'data:image/png;base64,abc', 'business logo wins')
assert.equal(businessLogo.accentColor, base.accentColor, 'null business accent falls through to partner/product')

const productOnly = deriveProductBrandView()
assert.equal(productOnly.logo, null, 'product view has no business logo')

const workspaceWithBusiness = resolveEffectiveBrandIdentity({
  logo: 'data:image/png;base64,abc',
})
const productWithBusinessActive = deriveProductBrandView()
assert.equal(workspaceWithBusiness.logo, 'data:image/png;base64,abc', 'workspace keeps business logo')
assert.equal(productWithBusinessActive.logo, null, 'product view ignores business layer')

console.log('effective-brand-identity-check passed')
