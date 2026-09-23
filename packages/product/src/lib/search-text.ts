/** Fold accents so Search treats José / Jose as the same name. */

export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function runSearchTextChecks(): void {
  const assert = (condition: unknown, message: string): void => {
    if (!condition) throw new Error(message)
  }

  assert(foldSearchText('José') === 'jose', 'folds acute accents')
  assert(foldSearchText('GARCÍA') === 'garcia', 'folds case and accents together')
  assert(foldSearchText('Muñoz') === 'munoz', 'folds ñ')
  assert(foldSearchText('Cançó') === 'canco', 'folds cedilla')
  assert(foldSearchText('  Factura  ') === '  factura  ', 'does not trim; callers decide')
}
