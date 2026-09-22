import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function runApplicationLifecycleCheck(): void {
  const main = readFileSync(path.join(root, "desktop/electron/main.ts"), "utf8");
  const settingsStore = readFileSync(
    path.join(root, "desktop/electron/settings-store.ts"),
    "utf8",
  );
  const preferences = readFileSync(
    path.join(root, "desktop/src/components/PreferencesPanel.tsx"),
    "utf8",
  );

  assert(
    main.includes("void openSettingsOrOnboarding()"),
    "launch path opens the main window",
  );
  assert(
    main.includes("APPLICATION-LIFECYCLE-001: Launch always shows the main window."),
    "ready handler documents the launch contract",
  );
  assert(main.includes("handleMainWindowClose"), "close hides instead of quitting by default");
  assert(
    main.includes("shouldKeepRunningInBackground"),
    "hosts without a tray can exit on close",
  );
  assert(
    /win32[\s\S]*app\.isPackaged/.test(main),
    "packaged Windows stays alive for Save As background helper",
  );
  assert(
    main.includes("openAsHidden: false"),
    "macOS login item opens the window, not hidden",
  );
  assert(
    /win32[\s\S]*!trayAvailable[\s\S]*minimize\(\)/.test(main),
    "Windows without tray minimizes to taskbar instead of hiding invisibly",
  );
  assert(
    main.includes("SUHUELLA_DESKTOP_VALIDATE_TRAY_UNAVAILABLE"),
    "validation-only tray failure hook is documented in main process",
  );
  assert(main.includes("destroyTray()"), "quit destroys the tray");
  assert(
    /app\.on\('second-instance'[\s\S]*openSettingsOrOnboarding\(\)/.test(main),
    "second launch focuses the existing window",
  );
  assert(
    /app\.on\('activate'[\s\S]*openSettingsOrOnboarding\(\)/.test(main),
    "macOS activate focuses the existing window",
  );

  assert(
    settingsStore.includes("launchAtLogin: false"),
    "start at login is off by default",
  );
  assert(
    preferences.includes("settings?.launchAtLogin ?? false"),
    "Settings checkbox default matches the contract",
  );
  assert(
    !preferences.includes("Start hidden"),
    "Start hidden is reserved and not shipped",
  );

  console.log("APPLICATION-LIFECYCLE-001 check passed");
}

runApplicationLifecycleCheck();
