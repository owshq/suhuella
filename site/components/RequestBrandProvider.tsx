"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { PublicPresentationBrand } from "@/lib/partners/presentation-brand-client";

const RequestBrandContext = createContext<PublicPresentationBrand | null>(null);

export function RequestBrandProvider({
  value,
  cssVars,
  children,
}: {
  value: PublicPresentationBrand;
  cssVars?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <RequestBrandContext.Provider value={value}>
      <div
        style={cssVars as CSSProperties | undefined}
        data-request-brand={value.brandId ?? "none"}
        data-brand-kind={value.kind}
      >
        {children}
      </div>
    </RequestBrandContext.Provider>
  );
}

export function useRequestBrand(): PublicPresentationBrand {
  const value = useContext(RequestBrandContext);
  if (!value) {
    return {
      kind: "unknown",
      servesApp: false,
      hostname: null,
      domainStatus: "unknown",
      brandId: null,
      displayName: "",
      logoUrl: null,
      accent: null,
      onAccent: null,
    };
  }
  return value;
}
