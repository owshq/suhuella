import { createBrandApi } from "../api.ts";
export {
  BRAND_IDS,
  FORBIDDEN_BRAND_CONFIG_KEYS,
  OPERATOR_IDS,
  type BrandConfig,
  type BrandId,
  type BrandTheme,
  type OperatorId,
} from "../types.ts";
export { hasForbiddenSecretFields } from "../helpers.ts";
export {
  accentReadableOnNeutral,
  assertBrandTheme,
  brandPresentationCssVars,
  brandThemeCssVars,
  contrastRatio,
  darkenHex,
  isHexColor,
  resolveBrandTheme,
} from "../theme.ts";
import { suhuellaBrand } from "./brand.ts";

export const {
  brand,
  siteOrigin,
  siteUrl,
  supportMailto,
  salesMailto,
  desktopProtocolUrl,
  applyBrandPresentation,
  applyBrandPresentationDeep,
  licenseOtpReplyTo,
  licenseOtpFromDisplay,
  brandCssVars,
} = createBrandApi(suhuellaBrand);
