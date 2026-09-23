import type { ReleaseDecision } from './release-lifecycle.ts'

/**
 * Release checks are semver/install guidance only — not license or generation authority.
 * Security and minimum updates must not be framed as paid generation upgrades.
 */
export type ReleaseUpdateIntent = 'security_or_maintenance' | 'optional_feature' | 'current' | 'unknown'

export function releaseUpdateIntent(decision: ReleaseDecision): ReleaseUpdateIntent {
  if (decision.kind === 'current' || decision.kind === 'downgrade_blocked') return 'current'
  if (decision.kind === 'unknown') return 'unknown'
  if (decision.kind === 'update_mandatory') return 'security_or_maintenance'
  return 'optional_feature'
}

export function releaseCheckUserMessage(
  decision: ReleaseDecision,
  locale: 'en' | 'es' = 'en',
): string {
  const intent = releaseUpdateIntent(decision)
  const base =
    locale === 'es'
      ? {
          security_or_maintenance:
            'Hay una actualización recomendada. Las correcciones de seguridad no se venden como upgrade de generación y no cambian tu licencia.',
          optional_feature:
            'Hay una versión más reciente. Descargarla no modifica los derechos de tu licencia.',
          current: 'Esta instalación está al día.',
          unknown: 'No se pudo comprobar si hay actualizaciones.',
        }
      : {
          security_or_maintenance:
            'An update is recommended. Security fixes are not sold as generation upgrades and do not change your license.',
          optional_feature:
            'A newer version is available. Downloading it does not change your license rights.',
          current: 'This install is up to date.',
          unknown: 'Could not check for updates.',
        }
  return base[intent]
}
