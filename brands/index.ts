export type { BrandConfig, BrandId, BrandOperationalEmails, BrandTheme, OperatorId } from "./types.ts";
export { BRAND_IDS, FORBIDDEN_BRAND_CONFIG_KEYS, OPERATOR_IDS } from "./types.ts";
export { hasForbiddenSecretFields } from "./helpers.ts";
export {
  accentReadableOnNeutral,
  assertBrandTheme,
  brandPresentationCssVars,
  brandThemeCssVars,
  contrastRatio,
  darkenHex,
  isHexColor,
  resolveBrandTheme,
} from "./theme.ts";
export {
  brand,
  desktopProtocolUrl,
  isBrandId,
  knownBrandIds,
  resolveBrand,
  resolveBrandId,
  licenseOtpFromDisplay,
  licenseOtpReplyTo,
  salesMailto,
  siteOrigin,
  siteUrl,
  supportMailto,
} from "./resolve.ts";

import { createBrandApi } from "./api.ts";
import { brand } from "./resolve.ts";

const api = createBrandApi(brand);
export const applyBrandPresentation = api.applyBrandPresentation;
export const applyBrandPresentationDeep = api.applyBrandPresentationDeep;
export const brandCssVars = api.brandCssVars;
