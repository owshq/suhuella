import { applyBrandPresentation, brand } from '@suhuella/brand'

export function productCopy(text: string): string {
  return applyBrandPresentation(text)
}

export function productName(): string {
  return brand.displayName
}
