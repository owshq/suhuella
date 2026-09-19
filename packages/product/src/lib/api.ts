import { brand } from '@suhuella/brand'
import type { SuhuellaAPI } from '../vite-env'

export function getSuhuellaApi(): SuhuellaAPI {
  if (!window.suhuella) {
    throw new Error(`${brand.displayName} is not ready in this window.`)
  }
  return window.suhuella
}

export function invokeSuhuella<K extends keyof SuhuellaAPI>(
  method: K,
  ...args: Parameters<SuhuellaAPI[K]>
): Promise<Awaited<ReturnType<SuhuellaAPI[K]>>> {
  const api = getSuhuellaApi()
  const fn = api[method]
  if (typeof fn !== 'function') {
    return Promise.reject(new Error(`${String(method)} is not available. Restart ${brand.displayName}.`))
  }
  return Promise.resolve(
    (fn as (...values: Parameters<SuhuellaAPI[K]>) => ReturnType<SuhuellaAPI[K]>).apply(api, args),
  ) as Promise<Awaited<ReturnType<SuhuellaAPI[K]>>>
}
