import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  deriveProductBrandView,
  resolveEffectiveBrandIdentity,
  type BusinessBrandOverrides,
  type EffectiveBrandIdentity,
  type ProductBrandIdentity,
} from '../lib/effective-brand-identity'

type AppBrandingContextValue = {
  businessOverrides: BusinessBrandOverrides
  workspace: EffectiveBrandIdentity
  product: ProductBrandIdentity
}

const AppBrandingContext = createContext<AppBrandingContextValue | null>(null)

type AppBrandingProviderProps = {
  /** @deprecated Prefer businessOverrides — kept for licence logo wiring. */
  organisationLogo?: string | null
  businessOverrides?: BusinessBrandOverrides
  children: ReactNode
}

export function AppBrandingProvider({
  organisationLogo = null,
  businessOverrides,
  children,
}: AppBrandingProviderProps) {
  const parent = useContext(AppBrandingContext)
  const value = useMemo(() => {
    const overrides: BusinessBrandOverrides = {
      ...parent?.businessOverrides,
      ...businessOverrides,
      ...(organisationLogo != null && organisationLogo.trim()
        ? { logo: organisationLogo.trim() }
        : {}),
    }
    return {
      businessOverrides: overrides,
      workspace: resolveEffectiveBrandIdentity(overrides),
      product: deriveProductBrandView(),
    }
  }, [businessOverrides, organisationLogo, parent?.businessOverrides])

  return <AppBrandingContext.Provider value={value}>{children}</AppBrandingContext.Provider>
}

/** WorkspaceBrandView — full merge including business overrides (ADR-003). */
export function useEffectiveBrandIdentity(): EffectiveBrandIdentity {
  const context = useContext(AppBrandingContext)
  if (!context) {
    return resolveEffectiveBrandIdentity()
  }
  return context.workspace
}

/** ProductBrandView — same base resolver, empty business input (ADR-003). */
export function useProductBrandIdentity(): ProductBrandIdentity {
  const context = useContext(AppBrandingContext)
  if (!context) {
    return deriveProductBrandView()
  }
  return context.product
}

/** @deprecated Use useEffectiveBrandIdentity — ADR-003 */
export function useAppBranding(): { organisationLogo: string | null } {
  const context = useContext(AppBrandingContext)
  return { organisationLogo: context?.businessOverrides.logo ?? null }
}
