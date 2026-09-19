import { createRequire } from "node:module";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { brandIdentity, brandPublicDir, repoRoot, resolveBrandId } from "./select.mjs";
import { projectBrandEntry } from "./project-brand.mjs";

const require = createRequire(import.meta.url);

function loadOptional(moduleCandidates) {
  for (const candidate of moduleCandidates) {
    try {
      return require(candidate);
    } catch {
      // try next path
    }
  }
  return null;
}

const BRAND_PUBLIC_FILES = [
  "suhuella-logo.svg",
  "suhuella-logo.png",
  "suhuella-icon-192.png",
  "suhuella-icon-256.png",
  "suhuella-icon-512.png",
  "suhuella-app-icon.svg",
  "dbasenet-logo.svg",
  "dbasenet-logo.png",
  "dbasenet-icon-192.png",
  "dbasenet-icon-256.png",
  "dbasenet-icon-512.png",
];

const brandId = resolveBrandId();

// Always generate @suhuella/brand entry first — before any optional native deps.
await projectBrandEntry(brandId);

const identity = brandIdentity(brandId);
const publicDir = path.join(repoRoot, "site/public");
const appDir = path.join(repoRoot, "site/app");
await mkdir(publicDir, { recursive: true });

for (const fileName of BRAND_PUBLIC_FILES) {
  await rm(path.join(publicDir, fileName), { force: true });
}

const sourceDir = brandPublicDir(brandId);
for (const fileName of await readdir(sourceDir)) {
  await cp(path.join(sourceDir, fileName), path.join(publicDir, fileName));
}

const pwa = identity.pwa;
if (!pwa?.backgroundColor || !pwa.themeColor || !pwa.icon512 || !pwa.icon256 || !pwa.icon192 || !pwa.logoSvg) {
  throw new Error(`brands/${brandId}/identity.json is missing pwa projection fields.`);
}

const sharp = loadOptional([
  "../desktop/node_modules/sharp",
  "../site/node_modules/sharp",
]);
const toIco = loadOptional([
  "../desktop/node_modules/to-ico",
  "../site/node_modules/to-ico",
]);

const icon192Path = path.join(publicDir, path.basename(pwa.icon192));
const icon256Path = path.join(publicDir, path.basename(pwa.icon256));
const icon512Path = path.join(publicDir, path.basename(pwa.icon512));

try {
  await readFile(icon192Path);
} catch {
  if (!sharp) {
    console.warn("[brand] sharp missing — copying 256px icon as 192px fallback");
    await cp(icon256Path, icon192Path);
  } else {
    await sharp(icon256Path).resize(192, 192).png().toFile(icon192Path);
  }
}

const manifest = {
  name: identity.displayName,
  short_name: identity.displayName,
  description: "Your knowledge, on this computer. Documents never leave this computer.",
  start_url: "/home",
  scope: "/",
  display: "standalone",
  background_color: pwa.backgroundColor,
  theme_color: pwa.themeColor,
  icons: [
    { src: pwa.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: pwa.icon256, sizes: "256x256", type: "image/png", purpose: "any" },
    { src: pwa.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
  ],
};

await writeFile(path.join(publicDir, "app.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);

const appIconSvgName = path.basename(pwa.logoSvg).replace("-logo.svg", "-app-icon.svg");
const appIconSvgPath = path.join(publicDir, appIconSvgName);
const faviconTargets = [path.join(appDir, "favicon.ico"), path.join(publicDir, "favicon.ico")];

if (sharp && toIco) {
  let faviconSource;
  try {
    faviconSource = await readFile(appIconSvgPath);
  } catch {
    faviconSource = await readFile(icon512Path);
  }
  const faviconSizes = [16, 32, 48];
  const faviconBuffers = await Promise.all(
    faviconSizes.map((size) => sharp(faviconSource).resize(size, size).png().toBuffer()),
  );
  const faviconIco = await toIco(faviconBuffers);
  for (const target of faviconTargets) {
    await writeFile(target, faviconIco);
  }

  const logoSvgPath = path.join(publicDir, path.basename(pwa.logoSvg));
  const logoSvg = await readFile(logoSvgPath);
  const logoPngPath = path.join(publicDir, path.basename(pwa.logoSvg).replace(".svg", ".png"));
  await sharp(logoSvg).resize(512, 512).png().toFile(logoPngPath);
} else {
  console.warn("[brand] sharp/to-ico missing — favicon/logo PNG generation skipped (run npm install)");
}

console.log(`[brand] projected ${brandId} public assets and @suhuella/brand entry`);
