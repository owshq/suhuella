import { createHmac, timingSafeEqual } from "node:crypto";
import { textToBase64Url, verifyLicenseTokenSignature } from "./license-token-signing.ts";
import { sendTransactionalEmail } from "./resend-mail.ts";
import { listDurableGrants } from "./license-store.ts";

export const DESKTOP_UPDATE_SUBJECT =
  "SuHuella desktop update — improved offline license reliability";

const DESKTOP_UPDATE_TEXT = `Hi,

A new SuHuella desktop release is available with improved offline license verification.

If you use SuHuella without an internet connection, this update helps your paid license stay
recognized reliably while you are offline.

Your license is tied to your account — installing the update does not remove or reset it.

Download the latest version for your computer:
  https://suhuella.com/download

Run the installer on top of your current install. SuHuella stays in the menu bar / tray as usual.

If anything looks wrong after updating, reply to this email — we read support@suhuella.com.

— SuHuella`;

export function operatorTaskAuthorized(header: string | null): boolean {
  const expected = process.env.PARTNER_SESSION_SECRET?.trim() ?? "";
  const provided = header?.trim() ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function hmacLegacySigningSelfCheck(): Promise<boolean> {
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim() ?? "";
  if (!secret) return false;
  const body = textToBase64Url(
    JSON.stringify({
      licenseId: "lic_hmac_self_check",
      email: "hmac-self-check@suhuella.com",
      edition: "personal_lifetime",
    }),
  );
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  const verified = await verifyLicenseTokenSignature(`${body}.${signature}`);
  return verified.ok;
}

export async function sendDesktopUpdateNotices(): Promise<{
  sent: string[];
  failed: string[];
}> {
  const grants = await listDurableGrants();
  const recipients = [
    ...new Set(
      grants
        .filter((grant) => grant.status === "active" && grant.edition !== "free")
        .map((grant) => grant.email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const html = `<p>${DESKTOP_UPDATE_TEXT.split("\n\n")
    .join("</p><p>")
    .replace(
      "https://suhuella.com/download",
      '<a href="https://suhuella.com/download">https://suhuella.com/download</a>',
    )}</p>`;
  const sent: string[] = [];
  const failed: string[] = [];
  for (const to of recipients) {
    const result = await sendTransactionalEmail({
      to,
      subject: DESKTOP_UPDATE_SUBJECT,
      text: DESKTOP_UPDATE_TEXT,
      html,
    });
    if (result.ok) sent.push(to);
    else failed.push(to);
  }
  return { sent, failed };
}
