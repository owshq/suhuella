import { brand, licenseOtpFromDisplay, licenseOtpReplyTo } from "@suhuella/brand";

export const VERIFICATION_CODE_TTL_MINUTES = 10;
export const RESEND_TRANSIENT_RETRY_COUNT = 1;

export type SendVerificationCodeEmailInput = {
  to: string;
  code: string;
};

export type ResendMailDeps = {
  fetch?: typeof fetch;
};

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function verificationEmailSubject(displayName = brand.displayName): string {
  return `Your ${displayName} verification code`;
}

export function licenseOtpFromAddress(): string {
  return brand.emails?.licenses ?? "";
}

function mailboxFromHeader(from: string): string {
  const angled = from.match(/<([^>]+)>/);
  return (angled?.[1] ?? from).trim().toLowerCase();
}

export function isResendFromAligned(from = process.env.RESEND_FROM?.trim() ?? ""): boolean {
  const address = licenseOtpFromAddress().toLowerCase();
  if (!from || !address) return false;
  const mailbox = mailboxFromHeader(from);
  const domain = brand.primaryDomain.toLowerCase();
  if (!domain || !mailbox.endsWith(`@${domain}`)) return false;
  if (mailbox.startsWith("noreply@")) return false;
  const expected = licenseOtpFromDisplay();
  return from === expected || mailbox === address;
}

export function isEmailTransportConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

export function isLicenseOtpMailReady(): boolean {
  if (!isEmailTransportConfigured()) return false;
  if (!isResendFromAligned()) return false;
  if (brand.emails && !licenseOtpReplyTo()) return false;
  return true;
}

export function isTransientResendStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function verificationEmailText(input: { code: string; displayName?: string }): string {
  const displayName = input.displayName ?? brand.displayName;
  const replyTo = licenseOtpReplyTo();
  const lines = [
    verificationEmailSubject(displayName),
    "",
    input.code,
    "",
    `This code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.`,
    "",
    "If you did not request this, you can ignore this email.",
  ];
  if (replyTo) {
    lines.push("", `Replies go to ${replyTo}.`);
  }
  return lines.join("\n");
}

export function verificationEmailHtml(input: { code: string; displayName?: string }): string {
  const displayName = escapeHtml(input.displayName ?? brand.displayName);
  const code = escapeHtml(input.code);
  const replyTo = licenseOtpReplyTo();
  const replyLine = replyTo ? `<p>Replies go to ${escapeHtml(replyTo)}.</p>` : "";
  return [
    "<!DOCTYPE html><html><body>",
    `<p>Your ${displayName} verification code</p>`,
    `<p style="font-size:28px;letter-spacing:0.16em;font-family:ui-monospace,monospace">${code}</p>`,
    `<p>This code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.</p>`,
    "<p>If you did not request this, you can ignore this email.</p>",
    replyLine,
    "</body></html>",
  ].join("");
}

async function postResendEmail(
  apiKey: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Response | null> {
  const attempts = 1 + RESEND_TRANSIENT_RETRY_COUNT;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (response.ok) return response;
      if (!isTransientResendStatus(response.status) || attempt === attempts - 1) {
        return response;
      }
    } catch {
      if (attempt === attempts - 1) return null;
    }
  }
  return null;
}

export async function sendVerificationCodeEmail(
  input: SendVerificationCodeEmailInput,
  deps: ResendMailDeps = {},
): Promise<{ ok: true } | { ok: false; error: "not_configured" | "delivery_failed" }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM?.trim() ?? "";
  if (!apiKey || !from) {
    if (!isProductionRuntime()) {
      console.info(`[dev] ${verificationEmailSubject()} for ${input.to}: ${input.code}`);
      return { ok: true };
    }
    return { ok: false, error: "not_configured" };
  }

  if (!isResendFromAligned(from) || (brand.emails && !licenseOtpReplyTo())) {
    console.error("Resend From is not aligned with BrandConfig licenses address");
    return { ok: false, error: "not_configured" };
  }

  const replyTo = licenseOtpReplyTo();
  const fetchImpl = deps.fetch ?? fetch;

  try {
    const response = await postResendEmail(
      apiKey,
      {
        from,
        to: [input.to],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: verificationEmailSubject(),
        text: verificationEmailText({ code: input.code }),
        html: verificationEmailHtml({ code: input.code }),
      },
      fetchImpl,
    );

    if (!response || !response.ok) {
      console.error("Resend delivery failed", response?.status ?? "network");
      return { ok: false, error: "delivery_failed" };
    }

    return { ok: true };
  } catch {
    console.error("Resend delivery failed");
    return { ok: false, error: "delivery_failed" };
  }
}

export async function sendTransactionalEmail(
  input: { to: string; subject: string; text: string; html: string },
  deps: ResendMailDeps = {},
): Promise<{ ok: true } | { ok: false; error: "not_configured" | "delivery_failed" }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM?.trim() ?? "";
  if (!apiKey || !from || !isResendFromAligned(from)) {
    return { ok: false, error: "not_configured" };
  }
  const replyTo = licenseOtpReplyTo();
  const response = await postResendEmail(
    apiKey,
    {
      from,
      to: [input.to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: input.subject,
      text: input.text,
      html: input.html,
    },
    deps.fetch ?? fetch,
  );
  if (!response?.ok) return { ok: false, error: "delivery_failed" };
  return { ok: true };
}
