import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDictionary } from "./i18n/dictionary.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const forbiddenLaunchPhrases = [
  "No window appears",
  "No aparece una ventana",
  "only appears when you need it",
  "solo aparece cuando lo necesitas",
  "look for the icon in the tray",
  "busca el icono en la bandeja",
];

export function runApplicationLifecycleCheck(): void {
  const main = readFileSync(path.join(root, "desktop/electron/main.ts"), "utf8");
  const settingsStore = readFileSync(
    path.join(root, "desktop/electron/settings-store.ts"),
    "utf8",
  );
  const preferences = readFileSync(
    path.join(root, "packages/product/src/components/PreferencesPanel.tsx"),
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

  for (const locale of ["es", "en"] as const) {
    const dictionary = getDictionary(locale);
    const copy = [
      dictionary.success.trayNote,
      dictionary.success.unsignedNote,
      ...dictionary.success.installSteps,
      dictionary.download.trayNote,
    ].join("\n");
    for (const phrase of forbiddenLaunchPhrases) {
      assert(!copy.includes(phrase), `${locale} copy must not teach silent tray launch: ${phrase}`);
    }
    assert(
      copy.toLowerCase().includes("window") || copy.toLowerCase().includes("ventana"),
      `${locale} copy says the window appears`,
    );
  }

  console.log("APPLICATION-LIFECYCLE-001 check passed");
}

runApplicationLifecycleCheck();
