import {
  applyBrandPresentation as applyText,
  applyBrandPresentationDeep as applyDeep,
} from "./presentation.ts";
import {
  desktopProtocolUrlOf,
  salesMailtoOf,
  siteOriginOf,
  siteUrlOf,
  supportMailtoOf,
} from "./helpers.ts";
import { brandPresentationCssVars } from "./theme.ts";
import type { BrandConfig } from "./types.ts";

export function createBrandApi(brand: BrandConfig) {
  return {
    brand,
    brandCssVars: (config: BrandConfig = brand) => brandPresentationCssVars(config),
    siteOrigin: (config: BrandConfig = brand) => siteOriginOf(config),
    siteUrl: (pathname: string, config: BrandConfig = brand) => siteUrlOf(pathname, config),
    supportMailto: (config: BrandConfig = brand) => supportMailtoOf(config),
    salesMailto: (subject: string, config: BrandConfig = brand) => salesMailtoOf(subject, config),
    desktopProtocolUrl: (path: string, config: BrandConfig = brand) => desktopProtocolUrlOf(path, config),
    applyBrandPresentation: (text: string, config: BrandConfig = brand) => applyText(text, config),
    applyBrandPresentationDeep: <T>(value: T, config: BrandConfig = brand) => applyDeep(value, config),
    licenseOtpReplyTo: (config: BrandConfig = brand) => config.emails?.support ?? config.supportEmail,
    licenseOtpFromDisplay: (config: BrandConfig = brand) => {
      const address = config.emails?.licenses ?? (config.supportEmail ? `licenses@${config.primaryDomain}` : "");
      return address ? `${config.displayName} <${address}>` : config.displayName;
    },
  };
}
