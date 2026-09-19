import { createRequire } from "node:module";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { brandIdentity, brandPublicDir, repoRoot, resolveBrandId } from "./select.mjs";

const require = createRequire(import.meta.url);
const sharp = require("../desktop/node_modules/sharp");
const toIco = require("../desktop/node_modules/to-ico");

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

const icon192Path = path.join(publicDir, path.basename(pwa.icon192));
try {
  await readFile(icon192Path);
} catch {
  const icon256Path = path.join(publicDir, path.basename(pwa.icon256));
  await sharp(icon256Path).resize(192, 192).png().toFile(icon192Path);
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
const icon512Path = path.join(publicDir, path.basename(pwa.icon512));
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
await writeFile(path.join(appDir, "favicon.ico"), faviconIco);
await writeFile(path.join(publicDir, "favicon.ico"), faviconIco);

const logoSvgPath = path.join(publicDir, path.basename(pwa.logoSvg));
const logoSvg = await readFile(logoSvgPath);
const logoPngPath = path.join(publicDir, path.basename(pwa.logoSvg).replace(".svg", ".png"));
await sharp(logoSvg).resize(512, 512).png().toFile(logoPngPath);

const packageEntry = path.join(repoRoot, "brands/.build/entry.ts");
await mkdir(path.dirname(packageEntry), { recursive: true });
await writeFile(packageEntry, `export * from "../${brandId}/entry.ts";\n`);

console.log(`[brand] projected ${brandId} public assets and @suhuella/brand entry`);
