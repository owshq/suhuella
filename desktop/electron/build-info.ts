declare const __SUHUELLA_BUILD__: string | undefined

export function getBuildVersion(): string {
  if (typeof __SUHUELLA_BUILD__ === 'string' && __SUHUELLA_BUILD__.length > 0) {
    return __SUHUELLA_BUILD__
  }
  return 'local'
}
