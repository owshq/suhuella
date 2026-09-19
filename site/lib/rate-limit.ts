import { withLicensePersistence } from "./license-persistence/store.ts";

const WINDOW_MS = 15 * 60 * 1000;

export async function countRecentEvents(bucketKey: string, windowMs = WINDOW_MS): Promise<number> {
  const since = Date.now() - windowMs;
  const document = await import("./license-persistence/store.ts").then((mod) => mod.readLicensePersistence());
  return document.rateLimitEvents.filter(
    (event) => event.bucketKey === bucketKey && Date.parse(event.eventAt) >= since,
  ).length;
}

export async function recordRateLimitEvent(bucketKey: string): Promise<void> {
  await withLicensePersistence((document) => {
    const now = new Date().toISOString();
    document.rateLimitEvents.push({ bucketKey, eventAt: now });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    document.rateLimitEvents = document.rateLimitEvents.filter(
      (event) => Date.parse(event.eventAt) >= cutoff,
    );
  });
}

export async function isRateLimited(
  bucketKey: string,
  limit: number,
  windowMs = WINDOW_MS,
): Promise<boolean> {
  const count = await countRecentEvents(bucketKey, windowMs);
  return count >= limit;
}
