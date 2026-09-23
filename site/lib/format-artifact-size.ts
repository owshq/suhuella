/** Human-readable installer size for download UI and manifest display. */
export function formatArtifactSize(bytes: number, locale: "es" | "en" = "en"): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    const value = gb.toFixed(1);
    return locale === "es" ? `${value} GB` : `${value} GB`;
  }

  const mb = bytes / (1024 * 1024);
  const value = mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
  return locale === "es" ? `${value} MB` : `${value} MB`;
}
