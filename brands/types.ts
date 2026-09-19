export const BRAND_IDS = ["suhuella", "dbasenet"] as const;
export const OPERATOR_IDS = ["self"] as const;

export type BrandId = (typeof BRAND_IDS)[number];
export type OperatorId = (typeof OPERATOR_IDS)[number];

export type BrandPwaIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: "any" | "maskable" | "monochrome";
};

/** Operational @primaryDomain addresses. Inbound via Cloudflare Email Routing; app send via Resend. */
export type BrandOperationalEmails = {
  /** License OTP / recovery — Resend From; replies → support. */
  licenses: string;
  /** Customer support — public contact; OTP Reply-To. */
  support: string;
  /** Lifetime / Monthly / Business sales inquiries. */
  sales: string;
  /** Future white-label / partner inquiries. */
  partners: string;
  /** Payment and invoice questions. */
  billing: string;
  /** Privacy and data requests. */
  privacy: string;
  /** Security incidents. */
  security: string;
  /** Internal platform operations (Superadmin / ops). */
  operations: string;
};

export type BrandTheme = {
  /** CTA, nav active, links. */
  accent: string;
  /** Optional; derived as −8% luminosity when omitted. */
  accentHover?: string;
  /** Optional muted fill; derived as accent at 10% when omitted. */
  accentMuted?: string;
  /** Text on accent. Normally #FFFFFF. */
  onAccent: string;
};

export type BrandConfig = {
  id: BrandId;
  operatorId: OperatorId;
  displayName: string;
  primaryDomain: string;
  supportEmail: string | null;
  salesEmail: string | null;
  /** Full operational mailbox map when the Brand owns a domain. Null until configured. */
  emails: BrandOperationalEmails | null;
  /** Interactive UI color. Separate from pwa.themeColor / backgroundColor. */
  theme: BrandTheme;
  paidCheckoutEnabled: boolean;
  releaseRemoteEnabled: boolean;
  logo: {
    publicSvg: string;
    publicPng: string;
  };
  icon: {
    public256: string;
    public512: string;
  };
  desktopProductName: string;
  desktopAppId: string;
  desktopProtocol: string;
  pwa: {
    name: string;
    shortName: string;
    description: string;
    startUrl: "/home";
    backgroundColor: string;
    themeColor: string;
    icons: BrandPwaIcon[];
  };
  download: {
    macArtifactName: string;
    windowsArtifactName: string;
  };
  release: {
    version: string;
    channel: "stable" | "beta";
    minimumVersion: string;
    mandatory: boolean;
    windows: string;
    mac: string;
  };
};

export const FORBIDDEN_BRAND_CONFIG_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "LICENSE_SIGNING_SECRET",
  "stripeSecretKey",
  "resendApiKey",
  "licenseSigningSecret",
  "d1Binding",
  "r2Credentials",
] as const;
