/**
 * Host access capabilities — platform chapter of SOURCE-PLATFORM-READINESS-001.
 *
 * Answers "what can this host do?" independently of host kind.
 * Feature code asks these flags. It never asks host === "browser" or handle.kind.
 *
 * Profiles exist for electron, browser, ios, and android.
 * iOS and Android are reserved. They do not implement a mobile UI.
 */

export type SourcePlatformKind = "electron" | "browser" | "ios" | "android";

export type HostAccessCapabilities = {
  /** Persist a handle across sessions (Chrome IDB, Desktop path, Android SAF). */
  persistentHandles: boolean;
  /** Index while the app is not in the foreground. */
  backgroundIndexing: boolean;
  /** Host already sees local folders without a picker (Desktop Available). */
  filesystemAvailability: boolean;
  /** Watch folders for changes. Reserved; false on every current profile. */
  folderWatching: boolean;
  /** Permission survives restart without re-prompt (Desktop OS grant). */
  permanentPermissions: boolean;
  /** Host can walk the tree synchronously (Node fs). */
  synchronousAccess: boolean;
  /** Large on-disk index vs browser/mobile quota. */
  largeLocalStorage: boolean;
  /** User must grant access (Connect) rather than Add an already-visible folder. */
  connectGrant: boolean;
  /** Catalog of well-known folders the OS already sees. */
  directoryCatalog: boolean;
  /** System folders may be blocked (Chrome Documents / Downloads). */
  limitedSystemFolders: boolean;
  /** One-shot picker without persist (webkitdirectory). */
  ephemeralPicker: boolean;
  /** Scoped document picker (iOS / Android). Reserved. */
  scopedDocuments: boolean;
  /** Organise can pick from already-indexed sources. */
  organiseFromIndexedSources: boolean;
  /** Desktop Save As overlay (not the win32 Save As chrome flag). */
  saveAsOverlay: boolean;
};

export const HOST_ACCESS_PROFILES: Record<SourcePlatformKind, HostAccessCapabilities> = {
  electron: {
    persistentHandles: true,
    backgroundIndexing: true,
    filesystemAvailability: true,
    folderWatching: false,
    permanentPermissions: true,
    synchronousAccess: true,
    largeLocalStorage: true,
    connectGrant: false,
    directoryCatalog: true,
    limitedSystemFolders: false,
    ephemeralPicker: false,
    scopedDocuments: false,
    organiseFromIndexedSources: false,
    saveAsOverlay: true,
  },
  browser: {
    persistentHandles: true,
    backgroundIndexing: false,
    filesystemAvailability: false,
    folderWatching: false,
    permanentPermissions: false,
    synchronousAccess: false,
    largeLocalStorage: false,
    connectGrant: true,
    directoryCatalog: false,
    limitedSystemFolders: true,
    ephemeralPicker: true,
    scopedDocuments: false,
    organiseFromIndexedSources: true,
    saveAsOverlay: false,
  },
  ios: {
    persistentHandles: false,
    backgroundIndexing: false,
    filesystemAvailability: false,
    folderWatching: false,
    permanentPermissions: false,
    synchronousAccess: false,
    largeLocalStorage: false,
    connectGrant: true,
    directoryCatalog: false,
    limitedSystemFolders: false,
    ephemeralPicker: false,
    scopedDocuments: true,
    organiseFromIndexedSources: true,
    saveAsOverlay: false,
  },
  android: {
    persistentHandles: true,
    backgroundIndexing: false,
    filesystemAvailability: false,
    folderWatching: false,
    permanentPermissions: false,
    synchronousAccess: false,
    largeLocalStorage: false,
    connectGrant: true,
    directoryCatalog: false,
    limitedSystemFolders: false,
    ephemeralPicker: false,
    scopedDocuments: true,
    organiseFromIndexedSources: true,
    saveAsOverlay: false,
  },
};

export function sourcePlatformKind(
  host?: SourcePlatformKind | "electron" | "browser" | string | null,
): SourcePlatformKind {
  if (host === "ios" || host === "android" || host === "browser" || host === "electron") {
    return host;
  }
  return "electron";
}

export function hostAccessFor(
  host?: SourcePlatformKind | "electron" | "browser" | string | null,
  overrides?: Partial<HostAccessCapabilities>,
): HostAccessCapabilities {
  return { ...HOST_ACCESS_PROFILES[sourcePlatformKind(host)], ...overrides };
}

export function hostAccessFromLegacyBrowserFlag(browser = true): HostAccessCapabilities {
  return hostAccessFor(browser ? "browser" : "electron");
}
