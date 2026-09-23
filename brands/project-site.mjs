import { createRequire } from "node:module";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { brandIdentity, brandPublicDir, repoRoot, resolveBrandId } from "./select.mjs";
import { projectBrandEntry } from "./project-brand.mjs";

const require = createRequire(import.meta.url);

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfChanged(source, dest) {
  try {
    const [srcStat, destStat] = await Promise.all([stat(source), stat(dest)]);
    if (srcStat.size === destStat.size && destStat.mtimeMs >= srcStat.mtimeMs) return;
  } catch {
    // dest missing
  }
  await cp(source, dest);
}

async function writeIfChanged(filePath, contents) {
  try {
    const current = await readFile(filePath);
    if (Buffer.isBuffer(contents) ? current.equals(contents) : current.toString("utf8") === contents) return;
  } catch {
    // dest missing
  }
  await writeFile(filePath, contents);
}

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

const sourceDir = brandPublicDir(brandId);
const sourceFiles = new Set(await readdir(sourceDir));
for (const fileName of BRAND_PUBLIC_FILES) {
  if (sourceFiles.has(fileName)) continue;
  await rm(path.join(publicDir, fileName), { force: true });
}
for (const fileName of sourceFiles) {
  await copyIfChanged(path.join(sourceDir, fileName), path.join(publicDir, fileName));
}

const pwa = identity.pwa;
if (!pwa?.backgroundColor || !pwa.themeColor || !pwa.icon512 || !pwa.icon256 || !pwa.icon192 || !pwa.logoSvg) {
  throw new Error(`brands/${brandId}/identity.json is missing pwa projection fields.`);
}

const icon192Path = path.join(publicDir, path.basename(pwa.icon192));
const icon256Path = path.join(publicDir, path.basename(pwa.icon256));
const icon512Path = path.join(publicDir, path.basename(pwa.icon512));
const appIconSvgName = path.basename(pwa.logoSvg).replace("-logo.svg", "-app-icon.svg");
const appIconSvgPath = path.join(publicDir, appIconSvgName);
const faviconTargets = [path.join(appDir, "favicon.ico"), path.join(publicDir, "favicon.ico")];
const logoSvgPath = path.join(publicDir, path.basename(pwa.logoSvg));
const logoPngPath = path.join(publicDir, path.basename(pwa.logoSvg).replace(".svg", ".png"));
const icon192Ready = await pathExists(icon192Path);
const faviconReady = (await Promise.all(faviconTargets.map(pathExists))).every(Boolean);
const logoPngReady = await pathExists(logoPngPath);
const needsNative = !icon192Ready || !faviconReady || !logoPngReady;
const sharp = needsNative
  ? loadOptional(["../desktop/node_modules/sharp", "../site/node_modules/sharp"])
  : null;
const toIco = needsNative
  ? loadOptional(["../desktop/node_modules/to-ico", "../site/node_modules/to-ico"])
  : null;

if (!icon192Ready) {
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

await writeIfChanged(path.join(publicDir, "app.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);

if (needsNative && sharp && toIco) {
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
    await writeIfChanged(target, faviconIco);
  }

  if (!logoPngReady) {
    const logoSvg = await readFile(logoSvgPath);
    await sharp(logoSvg).resize(512, 512).png().toFile(logoPngPath);
  }
} else if (needsNative && (!sharp || !toIco)) {
  console.warn("[brand] sharp/to-ico missing — favicon/logo PNG generation skipped (run npm install)");
}

console.log(`[brand] projected ${brandId} public assets and @suhuella/brand entry`);
