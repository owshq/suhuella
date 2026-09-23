const SECRET_KEY = /secret|token|password|authorization|jwt|cookie|api[-_]?key|card|cvv/i;

/** Drop credentials from Operations audit payloads. Keeps emails, ids, and reasons. */
export function redactAuditValue(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) return null;
  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof raw === "string" && (raw.startsWith("eyJ") || raw.startsWith("sk_"))) continue;
    next[key] = raw;
  }
  return next;
}
