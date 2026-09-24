import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  stripCheckoutReturnSearch,
} from "@suhuella/product/lib/app-routes.ts";
import {
  ACTIVATION_ATTEMPT_STORAGE_KEY,
} from "@suhuella/product/lib/license-plans.ts";
import {
  APP_LOCALE_KEY,
  APP_LOCALE_USER_KEY,
} from "@suhuella/product/lib/app-locale.ts";
import {
  LEGACY_BROWSER_COMPUTER_NAME_KEY,
  persistBrowserComputerName,
} from "@suhuella/product/lib/device-identity.ts";
import {
  isPendingOrganiseContextExpired,
  PENDING_ORGANISE_KEY,
  PENDING_ORGANISE_MAX_AGE_MS,
  readPendingOrganiseContext,
  writePendingOrganiseContext,
  type PendingOrganiseContext,
} from "@suhuella/product/lib/organise-sources-bridge.ts";
import { LOCALE_COOKIE } from "./i18n/locale-cookie.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Documented browser persistence surface — add here when introducing new keys. */
const ALLOWED_LOCAL_STORAGE_KEYS = new Set([
  APP_LOCALE_KEY,
  APP_LOCALE_USER_KEY,
  LEGACY_BROWSER_COMPUTER_NAME_KEY,
  "suhuella-permissions",
  "suhuella-source-appearance",
  "suhuella.settings.sidebarCollapsed",
]);

const ALLOWED_SESSION_STORAGE_KEYS = new Set([
  ACTIVATION_ATTEMPT_STORAGE_KEY,
  PENDING_ORGANISE_KEY,
  "suhuella-opened-source",
]);

function runWebPersistenceHygieneCheck(): void {
  const root = join(process.cwd(), "..");
  const installHost = readFileSync(join(root, "packages/product/src/host/install-browser-host.ts"), "utf8");
  const licensePanel = readFileSync(join(root, "packages/product/src/components/LicenseStatusPanel.tsx"), "utf8");
  const deviceIdentity = readFileSync(join(root, "packages/product/src/lib/device-identity.ts"), "utf8");
  const localeCookie = readFileSync(join(process.cwd(), "lib/i18n/locale-cookie.ts"), "utf8");
  const appLocale = readFileSync(join(root, "packages/product/src/lib/app-locale.ts"), "utf8");

  assert(
    stripCheckoutReturnSearch("session_id=cs_test&checkout=success&prefs=license") === "prefs=license",
    "checkout return params are stripped from search",
  );
  assert(stripCheckoutReturnSearch("prefs=license") === "prefs=license", "unrelated query params are kept");
  assert(stripCheckoutReturnSearch("") === "", "empty search stays empty");

  assert(
    licensePanel.includes("stripCheckoutReturnFromLocation"),
    "license settings strip checkout params from the address bar",
  );
  assert(
    licensePanel.includes(`sessionStorage.removeItem(ACTIVATION_ATTEMPT_STORAGE_KEY)`),
    "activation attempt is cleared after checkout handling",
  );
  assert(
    !installHost.includes("'suhuella_activation_attempt_id'"),
    "browser host uses ACTIVATION_ATTEMPT_STORAGE_KEY constant",
  );
  assert(
    installHost.includes("ACTIVATION_ATTEMPT_STORAGE_KEY"),
    "browser host imports activation attempt key",
  );

  assert(
    !deviceIdentity.includes("localStorage.setItem"),
    "device name is not duplicated into localStorage",
  );
  assert(
    deviceIdentity.includes("clearLegacyBrowserComputerName"),
    "legacy device name localStorage is cleared on migration",
  );

  assert(!localeCookie.includes("writeLocaleCookie"), "dead writeLocaleCookie helper is removed");
  assert(appLocale.includes("document.cookie"), "locale cookie is written from app-locale only");
  assert(LOCALE_COOKIE === APP_LOCALE_KEY, "locale cookie name matches product locale key");

  assert(
    PENDING_ORGANISE_MAX_AGE_MS === 30 * 60 * 1000,
    "pending organise context expires after 30 minutes",
  );

  const fresh: PendingOrganiseContext = {
    kind: "folder",
    sourceId: "src_demo",
    sourceTitle: "demo",
    folderScope: "src_demo",
    fileIds: [],
    fileNames: [],
    createdAt: Date.now(),
  };
  assert(!isPendingOrganiseContextExpired(fresh), "fresh organise context is valid");
  assert(
    isPendingOrganiseContextExpired({ ...fresh, createdAt: Date.now() - PENDING_ORGANISE_MAX_AGE_MS - 1 }),
    "stale organise context is expired",
  );

  if (typeof sessionStorage !== "undefined") {
    writePendingOrganiseContext({ ...fresh, createdAt: Date.now() - PENDING_ORGANISE_MAX_AGE_MS - 1 });
    assert(readPendingOrganiseContext() === null, "expired organise context is purged from sessionStorage");
    sessionStorage.removeItem(PENDING_ORGANISE_KEY);
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LEGACY_BROWSER_COMPUTER_NAME_KEY, "Legacy MacBook");
    persistBrowserComputerName("Legacy MacBook");
    assert(
      localStorage.getItem(LEGACY_BROWSER_COMPUTER_NAME_KEY) === null,
      "persistBrowserComputerName clears legacy localStorage key",
    );
  }

  const storageKeyPattern = /localStorage\.(?:setItem|getItem)\(\s*['"]([^'"]+)['"]/g;
  for (const file of [
    join(root, "packages/product/src/host/install-browser-host.ts"),
    join(root, "packages/product/src/lib/app-locale.ts"),
    join(root, "packages/product/src/lib/device-identity.ts"),
    join(root, "packages/product/src/windows/SettingsWindow.tsx"),
  ]) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(storageKeyPattern)) {
      const key = match[1];
      assert(
        ALLOWED_LOCAL_STORAGE_KEYS.has(key),
        `unexpected localStorage key "${key}" in ${file}`,
      );
    }
  }

  const sessionKeyPattern = /sessionStorage\.(?:setItem|getItem|removeItem)\(\s*['"]([^'"]+)['"]/g;
  for (const file of [
    join(root, "packages/product/src/host/install-browser-host.ts"),
    join(root, "packages/product/src/lib/organise-sources-bridge.ts"),
    join(root, "packages/product/src/windows/SettingsWindow.tsx"),
  ]) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(sessionKeyPattern)) {
      const key = match[1];
      assert(
        ALLOWED_SESSION_STORAGE_KEYS.has(key) || key === ACTIVATION_ATTEMPT_STORAGE_KEY,
        `unexpected sessionStorage key "${key}" in ${file}`,
      );
    }
  }

  assert(ALLOWED_SESSION_STORAGE_KEYS.has(ACTIVATION_ATTEMPT_STORAGE_KEY), "activation key is documented");
}

runWebPersistenceHygieneCheck();
console.log("WEB-PERSISTENCE-HYGIENE-001 check passed");
