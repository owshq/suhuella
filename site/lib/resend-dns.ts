export type SpfStatus = "missing" | "ok" | "multiple";
export type Presence = "missing" | "present";

export function flattenTxtAnswers(answers: string[][] | string[]): string[] {
  return answers.map((item) => (Array.isArray(item) ? item.join("") : item));
}

export function collectSpfRecords(txtRecords: string[]): string[] {
  return txtRecords
    .map((record) => record.replaceAll('"', "").trim())
    .filter((record) => record.toLowerCase().startsWith("v=spf1"));
}

export function spfStatus(txtRecords: string[]): SpfStatus {
  const records = collectSpfRecords(txtRecords);
  if (records.length === 0) return "missing";
  if (records.length > 1) return "multiple";
  return "ok";
}

export function collectDmarcRecords(txtRecords: string[]): string[] {
  return txtRecords
    .map((record) => record.replaceAll('"', "").trim())
    .filter((record) => record.toUpperCase().startsWith("V=DMARC1"));
}

export function dmarcPresence(txtRecords: string[]): Presence {
  return collectDmarcRecords(txtRecords).length > 0 ? "present" : "missing";
}

export function isDkimTxt(record: string): boolean {
  const value = record.replaceAll('"', "").trim();
  const upper = value.toUpperCase();
  if (upper.startsWith("V=DKIM1")) return true;
  // RFC 6376: v is optional and defaults to DKIM1. Do not invent a key; only accept a published p=.
  return /(?:^|;)\s*p=[A-Za-z0-9+/=]+/.test(value);
}

export function dkimPresence(input: { txtRecords: string[]; cnameTargets: string[] }): Presence {
  if (input.cnameTargets.some((target) => target.trim().length > 0)) return "present";
  if (input.txtRecords.some(isDkimTxt)) return "present";
  return "missing";
}

export const RESEND_DKIM_SELECTOR_CANDIDATES = ["resend", "send", "default"] as const;

export function dkimSelectorsToProbe(extra?: string): string[] {
  const fromEnv = extra?.trim() || process.env.RESEND_DKIM_SELECTOR?.trim() || "";
  const selectors = new Set<string>(RESEND_DKIM_SELECTOR_CANDIDATES);
  if (fromEnv) selectors.add(fromEnv);
  return [...selectors];
}
