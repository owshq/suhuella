import { requestBrandServesApp } from "./request-brand.ts";
import type { RequestBrandContext } from "./request-brand.ts";
import {
  presentationBrandSupportsAppShell,
  type PublicPresentationBrand,
} from "./presentation-brand-client.ts";

export type { PublicPresentationBrand };
export { presentationBrandSupportsAppShell };

export function toPresentationBrand(ctx: RequestBrandContext): PublicPresentationBrand {
  const servesApp = requestBrandServesApp(ctx);

  if (ctx.kind === "platform" || ctx.kind === "partner") {
    return {
      kind: ctx.kind,
      servesApp,
      hostname: ctx.hostname,
      domainStatus: ctx.domainStatus,
      brandId: ctx.brandId,
      displayName: ctx.displayName,
      logoUrl: ctx.logoUrl,
      accent: ctx.accent,
      onAccent: ctx.onAccent,
    };
  }

  return {
    kind: ctx.kind,
    servesApp: false,
    hostname: ctx.hostname,
    domainStatus: ctx.domainStatus,
    brandId: null,
    displayName: "",
    logoUrl: null,
    accent: null,
    onAccent: null,
  };
}

