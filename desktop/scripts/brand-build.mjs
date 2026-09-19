import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  brandDesktopAssetDir,
  brandEntry,
  brandIdentity,
  brandPublicDir,
  resolveBrandId,
} from "../../brands/select.mjs";

export const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function selectedBrandId() {
  return resolveBrandId();
}

export function selectedBrandIdentity() {
  return brandIdentity();
}

export function selectedBrandEntry() {
  return brandEntry(selectedBrandId());
}

export function brandBuildDir(brandId = selectedBrandId()) {
  return path.join(desktopRoot, ".build", brandId);
}

export async function prepareDesktopPublic(brandId = selectedBrandId()) {
  const dest = path.join(brandBuildDir(brandId), "public");
  await mkdir(dest, { recursive: true });
  await cp(brandPublicDir(brandId), dest, { recursive: true });
  await cp(path.join(desktopRoot, "public/favicon.svg"), path.join(dest, "favicon.svg"));
  return dest;
}

export async function prepareDesktopPackAssets(brandId = selectedBrandId()) {
  const dest = path.join(brandBuildDir(brandId), "pack");
  await mkdir(dest, { recursive: true });
  const source =
    brandId === "suhuella" ? path.join(desktopRoot, "assets") : brandDesktopAssetDir(brandId);
  await cp(source, dest, { recursive: true });
  return dest;
}

export async function writeElectronBuilderConfig(brandId = selectedBrandId()) {
  const identity = brandIdentity(brandId);
  const out = brandBuildDir(brandId);
  const pack = path.join(out, "pack");
  const config = {
    appId: identity.desktopAppId,
    productName: identity.desktopProductName,
    directories: {
      output: path.join(".build", brandId, "release"),
    },
    forceCodeSigning: false,
    publish: null,
    files: [
      "package.json",
      { from: path.join(".build", brandId, "dist"), to: "dist" },
      { from: path.join(".build", brandId, "dist-electron"), to: "dist-electron" },
    ],
    extraMetadata: {
      main: "dist-electron/main.cjs",
      productName: identity.desktopProductName,
    },
    protocols: [
      {
        name: identity.desktopProductName,
        schemes: [identity.desktopProtocol],
      },
    ],
    mac: {
      category: "public.app-category.productivity",
      icon: path.join(".build", brandId, "pack/icon.icns"),
      identity: null,
      extendInfo: {
        CFBundleDisplayName: identity.desktopProductName,
        CFBundleName: identity.desktopProductName,
      },
      target: ["dmg", "zip"],
    },
    dmg: {
      artifactName: "${productName}-${version}.${ext}",
    },
    win: {
      icon: path.join(".build", brandId, "pack/icon.ico"),
      artifactName: "${productName}-Setup-${version}.${ext}",
      target: ["nsis"],
      extraResources: [
        {
          from: "native/win-save-watcher/publish",
          to: "win-save-watcher",
        },
      ],
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      installerIcon: path.join(".build", brandId, "pack/icon.ico"),
      uninstallerIcon: path.join(".build", brandId, "pack/icon.ico"),
      installerHeaderIcon: path.join(".build", brandId, "pack/icon.ico"),
      shortcutName: identity.desktopProductName,
      uninstallDisplayName: identity.desktopProductName,
      artifactName: "${productName}-Setup-${version}.${ext}",
    },
  };

  await mkdir(pack, { recursive: true });
  const dest = path.join(out, "electron-builder.json");
  await writeFile(dest, `${JSON.stringify(config, null, 2)}\n`);
  return dest;
}
