/** Shared release manifest parsing — authority file: brands/suhuella/release.json */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDownloadEntry(entry, legacyUrl = "") {
  if (entry && typeof entry === "object") {
    const urlRaw = entry.url;
    const url =
      urlRaw === null || urlRaw === undefined
        ? ""
        : typeof urlRaw === "string"
          ? urlRaw.trim()
          : "";
    const available = entry.available === true || Boolean(url);
    const sha256 =
      typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/i.test(entry.sha256.trim())
        ? entry.sha256.trim().toLowerCase()
        : undefined;
    const filename = trimString(entry.filename) || undefined;
    const size =
      typeof entry.size === "number" && Number.isFinite(entry.size) && entry.size > 0
        ? Math.trunc(entry.size)
        : undefined;
    return {
      available,
      url: url || null,
      ...(sha256 ? { sha256 } : {}),
      ...(filename ? { filename } : {}),
      ...(size ? { size } : {}),
    };
  }
  const legacy = trimString(legacyUrl);
  return { available: Boolean(legacy), url: legacy || null };
}

/**
 * Normalize operator manifest (new downloads.* shape or legacy mac/windows strings).
 */
export function normalizeReleaseManifest(raw, { brandId } = {}) {
  if (!raw || typeof raw !== "object") {
    throw new Error("release.json must be a JSON object.");
  }

  const version = trimString(raw.version);
  if (!version) {
    throw new Error("release.json is missing version.");
  }

  const minimumVersion = trimString(raw.minimumVersion) || version;
  const channel = raw.channel === "beta" ? "beta" : "stable";
  const mandatory = raw.mandatory === true;
  const notes = trimString(raw.notes);
  const releaseDate = trimString(raw.releaseDate);
  if (releaseDate && !DATE_RE.test(releaseDate)) {
    throw new Error(`release.json releaseDate must be YYYY-MM-DD, got "${releaseDate}".`);
  }

  const downloads = {
    web: normalizeDownloadEntry(raw.downloads?.web, ""),
    mac: normalizeDownloadEntry(raw.downloads?.mac, raw.mac),
    windows: normalizeDownloadEntry(raw.downloads?.windows, raw.windows),
  };

  if (downloads.web.available === false && !raw.downloads?.web) {
    downloads.web.available = true;
  }

  for (const [label, entry] of Object.entries(downloads)) {
    if (label === "web") continue;
    const url = entry.url ?? "";
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
          throw new Error(`${label} download url must be https.`);
        }
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(`${label} download url is invalid.`);
        }
        throw error;
      }
    }
  }

  const manifest = {
    version,
    channel,
    mandatory,
    downloads,
    minimumVersion,
    releaseDate: releaseDate || undefined,
    notes,
  };

  if (brandId) {
    manifest.brandId = brandId;
  }

  return manifest;
}

export function installerUrlsFromManifest(manifest) {
  return {
    mac: manifest.downloads.mac.url ?? "",
    windows: manifest.downloads.windows.url ?? "",
  };
}

export function siteReleaseFromAuthority(authority) {
  const normalized = normalizeReleaseManifest(authority);
  const { brandId: _brandId, ...siteManifest } = normalized;
  return siteManifest;
}

export function brandMirrorFromAuthority(authority, brandId) {
  return normalizeReleaseManifest(authority, { brandId });
}
