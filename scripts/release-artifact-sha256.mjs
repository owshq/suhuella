/**
 * SHA256 helpers for desktop installer publish + verify pipeline.
 *
 * Frozen rule: the release pipeline is artifact-based, never filename-based.
 * Upload skip is allowed only when remote SHA256 matches local SHA256.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * @param {string} filePath
 * @returns {Promise<string>} lowercase hex digest
 */
export async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Parse GNU-style `sha256sum` sidecar content.
 * @param {string} text
 * @returns {string | null}
 */
export function parseSha256Sidecar(text) {
  const line = text.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const match = /^([a-f0-9]{64})\s+/i.exec(line);
  return match ? match[1].toLowerCase() : null;
}

/**
 * @param {string} digest
 * @param {string} fileName
 */
export function formatSha256Sidecar(digest, fileName) {
  return `${digest.toLowerCase()}  ${fileName}\n`;
}

/**
 * @param {string} sidecarUrl
 * @returns {Promise<string | null>}
 */
export async function fetchRemoteSha256(sidecarUrl) {
  const res = await fetch(sidecarUrl, { redirect: "follow" });
  if (!res.ok) return null;
  return parseSha256Sidecar(await res.text());
}

/**
 * @param {string} sidecarPath
 * @returns {Promise<string | null>}
 */
export async function readLocalSha256Sidecar(sidecarPath) {
  try {
    return parseSha256Sidecar(await readFile(sidecarPath, "utf8"));
  } catch {
    return null;
  }
}
