export const OPERATIONS_CONSOLE_SECTIONS = [
  "dashboard",
  "customers",
  "business",
  "partners",
  "licenses",
  "billing",
  "activity",
] as const;

export type OperationsConsoleSection = (typeof OPERATIONS_CONSOLE_SECTIONS)[number];

/**
 * Path aliases onto the control-center areas.
 * Seats live under Business. Devices and gifts live under Licenses.
 * Diagnostics, support, and audit live under Activity.
 */
export const OPERATIONS_PUBLIC_SECTION_SLUGS = {
  licenses: "licenses",
  business: "business",
  partners: "partners",
  customers: "customers",
  billing: "billing",
  activity: "activity",
  seats: "business",
  devices: "licenses",
  activations: "licenses",
  gifts: "licenses",
  releases: "dashboard",
  support: "activity",
  usage: "activity",
  diagnostics: "activity",
  audit: "activity",
  onboarding: "partners",
} as const;

export type OperationsPublicSlug = keyof typeof OPERATIONS_PUBLIC_SECTION_SLUGS;

export function operationsSectionFromSlug(
  slug: string,
): OperationsConsoleSection | null {
  if ((OPERATIONS_CONSOLE_SECTIONS as readonly string[]).includes(slug)) {
    return slug as OperationsConsoleSection;
  }
  if (slug in OPERATIONS_PUBLIC_SECTION_SLUGS) {
    return OPERATIONS_PUBLIC_SECTION_SLUGS[slug as OperationsPublicSlug];
  }
  return null;
}
