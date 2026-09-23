import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_TAB_IDS,
  resolveSettingsTab,
} from "@suhuella/product/lib/settings-tabs.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runSettingsTabsCheck(): void {
  assert(DEFAULT_SETTINGS_TAB === "general", "Settings opens on General");
  assert(SETTINGS_TAB_IDS.join(",") === "general,ai,license,support", "Settings has four tabs");
  assert(resolveSettingsTab("") === "general", "empty prefs falls back to General");
  assert(resolveSettingsTab("unknown") === "general", "unknown prefs falls back to General");
  assert(resolveSettingsTab("license") === "license", "License stays a current tab");
  assert(resolveSettingsTab("ai") === "ai", "AI stays a current tab");
  assert(resolveSettingsTab("support") === "support", "Support is a current tab");

  assert(resolveSettingsTab("folders") === "general", "legacy folders maps to General");
  assert(resolveSettingsTab("connections") === "general", "legacy connections maps to General");
  assert(resolveSettingsTab("privacy") === "general", "legacy privacy maps to General");
  assert(resolveSettingsTab("notifications") === "general", "legacy notifications maps to General");
  assert(resolveSettingsTab("storage") === "support", "legacy storage maps to Support");
  assert(resolveSettingsTab("diagnostics") === "support", "legacy diagnostics maps to Support");
  assert(resolveSettingsTab("about") === "support", "legacy about maps to Support");

  const locale = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/app-locale.ts"),
    "utf8",
  );
  assert(locale.includes('support: "Support"'), "English names the Support tab");
  assert(locale.includes('support: "Soporte"'), "Spanish names the Support tab");
  assert(!locale.includes("settingsSupport"), "Settings does not expose Configure/Support group labels");

  const panel = readFileSync(
    join(process.cwd(), "../packages/product/src/components/PreferencesPanel.tsx"),
    "utf8",
  );
  assert(panel.includes("SETTINGS_TAB_IDS.map"), "Settings nav renders the four current tabs");
  assert(panel.includes("<PrivacySection"), "Privacy lives in General");
  assert(panel.includes("caps.notifications"), "Notifications are desktop-only in General");
  assert(panel.includes("<NotificationsSection"), "Notifications live in General");
  assert(panel.includes("<AboutSection appInfo={appInfo} />"), "About lives in Support");
  assert(panel.includes("<DiagnosticsSection appInfo={appInfo} />"), "Diagnostics live in Support");
  assert(panel.includes("<StorageManageSection"), "Manage/logs live in Support");
  assert(!panel.includes("SETTINGS_TAB_GROUPS"), "seven-tab groups are gone");
  assert(!panel.includes("tab === 'privacy'"), "Privacy is not a top-level tab");
  assert(!panel.includes("tab === 'notifications'"), "Notifications is not a top-level tab");
  assert(!panel.includes("tab === 'diagnostics'"), "Diagnostics is not a top-level tab");
  assert(!panel.includes("tab === 'about'"), "About is not a top-level tab");
  assert(!panel.includes("{t.computer}"), "General does not show passive computer identity");
  assert(!panel.includes('<h2 className="text-base font-semibold text-slate-900">Save As</h2>'), "General does not duplicate Save As availability");

  const diagnosticsSection = panel.slice(panel.indexOf("function DiagnosticsSection"));
  assert(!diagnosticsSection.includes('<dt className="text-slate-500">Version</dt>'), "Diagnostics does not repeat version");
  assert(!diagnosticsSection.includes('<dt className="text-slate-500">Build</dt>'), "Diagnostics does not repeat build");

  const licensePanel = readFileSync(
    join(process.cwd(), "../packages/product/src/components/LicenseStatusPanel.tsx"),
    "utf8",
  );
  assert(licensePanel.includes("LicensedDeviceSection"), "License shows licensed device information");
  assert(licensePanel.includes("Activated on"), "License names the active device");
  assert(licensePanel.includes("Your license is active on another device"), "License explains remote activation");
  assert(licensePanel.includes("Deactivate that device"), "License can deactivate a remote device");
  assert(licensePanel.includes("BusinessOrganisationSection"), "Business admin manages the organisation in License");
  assert(!licensePanel.includes("Manage Business licenses"), "License does not open a Business web portal");
  assert(!licensePanel.includes("siteUrl('/business')"), "License does not send admins to a customer /business page");
  assert(!licensePanel.includes("Manage devices"), "License does not hide device management behind a toggle");
  assert(!licensePanel.includes('tab === "devices"'), "License does not add a Devices tab");
  assert(!licensePanel.includes('tab === "billing"'), "Billing is not a Settings tab");
  assert(!licensePanel.includes('tab === "team"'), "Team is not a Settings tab");

  const organisationPanel = readFileSync(
    join(process.cwd(), "../packages/product/src/components/BusinessOrganisationSection.tsx"),
    "utf8",
  );
  assert(organisationPanel.includes("Change seats"), "Business admin can change seats from License");
  assert(organisationPanel.includes("Assign"), "Business admin can assign seats from License");
  assert(organisationPanel.includes("Unassign"), "Business admin can unassign seats from License");
  assert(organisationPanel.includes("Replace computer"), "Business admin can replace a computer from License");
  assert(organisationPanel.includes("change_seats"), "Seat quantity uses the shared Business billing operation");
  assert(organisationPanel.includes("openCheckout('business'"), "Billing still opens the public Business checkout path");
  assert(!organisationPanel.includes("partner.suhuella.com"), "Partner is not mixed into Business admin");

  console.log("Settings tabs check passed");
}

runSettingsTabsCheck();
