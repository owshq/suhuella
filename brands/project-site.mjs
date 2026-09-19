import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { brandIdentity, brandPublicDir, repoRoot, resolveBrandId } from "./select.mjs";

const BRAND_PUBLIC_FILES = [
  "suhuella-logo.svg",
  "suhuella-logo.png",
  "suhuella-icon-256.png",
  "suhuella-icon-512.png",
  "suhuella-app-icon.svg",
  "dbasenet-logo.svg",
  "dbasenet-logo.png",
  "dbasenet-icon-256.png",
  "dbasenet-icon-512.png",
];

const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const publicDir = path.join(repoRoot, "site/public");
await mkdir(publicDir, { recursive: true });

for (const fileName of BRAND_PUBLIC_FILES) {
  await rm(path.join(publicDir, fileName), { force: true });
}

const sourceDir = brandPublicDir(brandId);
for (const fileName of await readdir(sourceDir)) {
  await cp(path.join(sourceDir, fileName), path.join(publicDir, fileName));
}

const pwa = identity.pwa;
if (!pwa?.backgroundColor || !pwa.themeColor || !pwa.icon512 || !pwa.icon256 || !pwa.logoSvg) {
  throw new Error(`brands/${brandId}/identity.json is missing pwa projection fields.`);
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
    { src: pwa.logoSvg, sizes: "any", type: "image/svg+xml", purpose: "any" },
  ],
};

await writeFile(path.join(publicDir, "app.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);

const packageEntry = path.join(repoRoot, "brands/.build/entry.ts");
await mkdir(path.dirname(packageEntry), { recursive: true });
await writeFile(packageEntry, `export * from "../${brandId}/entry.ts";\n`);

console.log(`[brand] projected ${brandId} public assets and @suhuella/brand entry`);
