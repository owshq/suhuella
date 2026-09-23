import { configuredPriceId, loadCatalogPrice, STRIPE_CATALOG } from "../stripe-catalog.ts";

export type PartnerProgramLocale = "en" | "es";

export type PartnerPublicPrice = {
  label: string;
  source: "stripe_price" | "catalog_fallback" | "unspecified";
  priceId: string | null;
  taxNote: string;
};

function formatAmount(locale: PartnerProgramLocale, unitAmountCents: number): string {
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "eur",
    maximumFractionDigits: 0,
  }).format(unitAmountCents / 100);
}

function taxNote(locale: PartnerProgramLocale, source: PartnerPublicPrice["source"]): string {
  if (locale === "es") {
    if (source === "stripe_price") {
      return "Impuestos según facturación en Stripe Checkout.";
    }
    if (source === "catalog_fallback") {
      return "Cuota anual de plataforma. Impuestos según Stripe Checkout.";
    }
    return "Cuota anual de plataforma.";
  }
  if (source === "stripe_price") {
    return "Tax treatment follows Stripe Checkout billing.";
  }
  if (source === "catalog_fallback") {
    return "Annual platform fee. Tax follows Stripe Checkout.";
  }
  return "Annual platform fee.";
}

export async function resolvePartnerPublicPrice(
  locale: PartnerProgramLocale,
): Promise<PartnerPublicPrice> {
  const priceId = configuredPriceId("partner");
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (priceId && secretKey) {
    const loaded = await loadCatalogPrice("partner", secretKey);
    if (loaded.ok) {
      return {
        label: `${formatAmount(locale, loaded.price.unitAmountCents)} / ${locale === "es" ? "año" : "year"}`,
        source: "stripe_price",
        priceId: loaded.price.priceId,
        taxNote: taxNote(locale, "stripe_price"),
      };
    }
  }
  const fallbackCents = STRIPE_CATALOG.partner.unitAmountCents;
  if (typeof fallbackCents === "number" && fallbackCents > 0) {
    return {
      label: `${formatAmount(locale, fallbackCents)} / ${locale === "es" ? "año" : "year"}`,
      source: "catalog_fallback",
      priceId: priceId || null,
      taxNote: taxNote(locale, "catalog_fallback"),
    };
  }
  return {
    label: locale === "es" ? "Cuota anual de plataforma" : "Annual platform fee",
    source: "unspecified",
    priceId: null,
    taxNote: taxNote(locale, "unspecified"),
  };
}

export type PartnerProgramStepId =
  | "verify_email"
  | "checkout"
  | "portal"
  | "activation";

export type PartnerProgramCopy = {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroBody: string;
  priceSectionTitle: string;
  priceLabel: string;
  priceNote: string;
  priceCtaHint: string;
  requirementsTitle: string;
  requirements: string[];
  stepsTitle: string;
  steps: { id: PartnerProgramStepId; title: string; body: string }[];
  verifyTitle: string;
  verifyBody: string;
  emailLabel: string;
  codeLabel: string;
  displayNameLabel: string;
  displayNameHint: string;
  submitInterest: string;
  sendCode: string;
  verifyCode: string;
  continueSetup: string;
  applicationReceived: string;
  emailPrivacy: string;
  partnerAccessReady: string;
  partnerAccessPending: string;
  paidClosedNotice: string;
  paidReadyNotice: string;
  emailVerifiedClosedCheckout: string;
  activationPending: string;
  activationComplete: string;
  notOnPlatformHost: string;
  portalLinkLabel: string;
  checkoutButton: string;
  checkoutClosedHint: string;
  verifyBeforeCheckout: string;
  checkoutReturnHint: string;
  manageInPortal: string;
  existingPartnerHint: string;
};

export function partnerProgramCopy(
  locale: PartnerProgramLocale,
  price: PartnerPublicPrice,
): PartnerProgramCopy {
  const priceText = price.label;

  if (locale === "es") {
    return {
      metaTitle: "Hazte partner — SuHuella",
      metaDescription:
        "Opera SuHuella bajo tu marca y dominio. Cuota anual, pago en Stripe Checkout y panel para configurar marca, hostname y licencias.",
      heroTitle: "Opera SuHuella bajo tu marca",
      heroBody:
        "Publica la plataforma con tu identidad visual y tu dominio. Verifica tu email, paga la cuota anual y configura todo desde el panel de partner.",
      priceSectionTitle: "Licencia anual de plataforma",
      priceLabel: priceText,
      priceNote: price.taxNote,
      priceCtaHint: "Pago seguro en Stripe Checkout. No almacenamos datos de tarjeta.",
      requirementsTitle: "Requisitos",
      requirements: [
        "Dominio propio para publicar la app (p. ej. tu-dominio.com o subdominio.tu-dominio.com).",
        "Acceso DNS para registros CNAME y TXT.",
        "Email corporativo verificable del administrador.",
      ],
      stepsTitle: "Cómo funciona",
      steps: [
        {
          id: "verify_email",
          title: "Verifica tu email",
          body: "Confirmamos que eres el titular antes de abrir el pago o el panel.",
        },
        {
          id: "checkout",
          title: "Paga en Stripe Checkout",
          body: `Cuota anual (${priceText}). El derecho a operar la marca se activa cuando Stripe confirma el pago.`,
        },
        {
          id: "portal",
          title: "Configura en el panel",
          body: "Marca, hostname, DNS y licencias de tus clientes — todo desde /partners/portal.",
        },
        {
          id: "activation",
          title: "Activa tu dominio",
          body: "Tu marca se sirve en tu hostname cuando DNS y TLS quedan verificados.",
        },
      ],
      verifyTitle: "Identificación",
      verifyBody: "Introduce el email que usarás como titular del partner y como acceso al panel.",
      emailLabel: "Email",
      codeLabel: "Código de verificación",
      displayNameLabel: "Nombre comercial",
      displayNameHint: "Cómo se mostrará tu marca (p. ej. Acme Cloud).",
      submitInterest: "Registrar interés (sin pago)",
      sendCode: "Enviar código",
      verifyCode: "Verificar email",
      continueSetup: "Abrir panel",
      applicationReceived:
        "Solicitud recibida. No implica activación ni plazos definidos.",
      emailPrivacy:
        "Usamos tu email solo para verificar identidad y gestionar tu partner.",
      partnerAccessReady:
        "Ya tienes acceso de partner. Entra al panel con este email para configurar marca y dominio.",
      partnerAccessPending:
        "Tu email tiene un alta pendiente. Entra al panel con el mismo email para continuar.",
      paidClosedNotice:
        "El pago online está temporalmente cerrado. Verifica tu email y registra interés; te avisaremos cuando Stripe Checkout esté disponible.",
      paidReadyNotice: "Email verificado. Continúa al pago en Stripe.",
      emailVerifiedClosedCheckout:
        "Email verificado. El pago online no está disponible ahora — registra tu interés abajo.",
      activationPending:
        "Licencia activa. Completa hostname y DNS en el panel.",
      activationComplete: "Partner activo con hostname verificado.",
      notOnPlatformHost: "El programa partner solo está en suhuella.com.",
      portalLinkLabel: "Panel de partner",
      checkoutButton: "Pagar con Stripe",
      checkoutClosedHint: "Pago online no disponible ahora",
      verifyBeforeCheckout: "Verifica tu email en este panel antes de continuar al pago.",
      checkoutReturnHint:
        "Tras pagar, entra al panel con el mismo email cuando Stripe confirme el pago.",
      manageInPortal: "Ir al panel",
      existingPartnerHint: "¿Ya eres partner?",
    };
  }

  return {
    metaTitle: "Become a partner — SuHuella",
    metaDescription:
      "Run SuHuella under your brand and domain. Annual fee, Stripe Checkout payment, and a panel for brand, hostname, and customer licenses.",
    heroTitle: "Run SuHuella under your brand",
    heroBody:
      "Publish the platform with your visual identity and domain. Verify your email, pay the annual fee, and configure everything in the partner panel.",
    priceSectionTitle: "Annual platform license",
    priceLabel: priceText,
    priceNote: price.taxNote,
    priceCtaHint: "Secure payment on Stripe Checkout. We never store card details.",
    requirementsTitle: "Requirements",
    requirements: [
      "Your own domain to publish the app (e.g. your-domain.com or subdomain.your-domain.com).",
      "DNS access for CNAME and TXT records.",
      "A verifiable work email for the administrator.",
    ],
    stepsTitle: "How it works",
    steps: [
      {
        id: "verify_email",
        title: "Verify your email",
        body: "We confirm you are the owner before opening payment or the panel.",
      },
      {
        id: "checkout",
        title: "Pay on Stripe Checkout",
        body: `Annual fee (${priceText}). Your right to operate the brand activates when Stripe confirms payment.`,
      },
      {
        id: "portal",
        title: "Configure in the panel",
        body: "Brand, hostname, DNS, and customer licenses — all from /partners/portal.",
      },
      {
        id: "activation",
        title: "Activate your domain",
        body: "Your brand is served on your hostname once DNS and TLS are verified.",
      },
    ],
    verifyTitle: "Identification",
    verifyBody: "Enter the email you will use as partner owner and panel sign-in.",
    emailLabel: "Email",
    codeLabel: "Verification code",
    displayNameLabel: "Brand display name",
    displayNameHint: "How your brand appears (e.g. Acme Cloud).",
    submitInterest: "Register interest (no payment)",
    sendCode: "Send code",
    verifyCode: "Verify email",
    continueSetup: "Open panel",
    applicationReceived:
      "Application received. This does not imply activation or defined timelines.",
    emailPrivacy: "We use your email only to verify identity and manage your partner.",
    partnerAccessReady:
      "You already have partner access. Sign in to the panel with this email to configure brand and domain.",
    partnerAccessPending:
      "Your email has a pending enrollment. Sign in to the panel with the same email to continue.",
    paidClosedNotice:
      "Online payment is temporarily closed. Verify your email and register interest — we will notify you when Stripe Checkout opens.",
    paidReadyNotice: "Email verified. Continue to payment on Stripe.",
    emailVerifiedClosedCheckout:
      "Email verified. Online payment is unavailable right now — register interest below.",
    activationPending: "License active. Complete hostname and DNS in the panel.",
    activationComplete: "Partner active with verified hostname.",
    notOnPlatformHost: "The partner program is only on suhuella.com.",
    portalLinkLabel: "Partner panel",
    checkoutButton: "Pay with Stripe",
    checkoutClosedHint: "Online payment unavailable right now",
    verifyBeforeCheckout: "Verify your email in this panel before continuing to payment.",
    checkoutReturnHint:
      "After paying, sign in to the panel with the same email once Stripe confirms payment.",
    manageInPortal: "Go to panel",
    existingPartnerHint: "Already a partner?",
  };
}

/** @deprecated Prefer resolvePartnerPublicPrice for display. */
export function formatPartnerAnnualPrice(locale: PartnerProgramLocale): string {
  const fallbackCents = STRIPE_CATALOG.partner.unitAmountCents ?? 100_000;
  return `${formatAmount(locale, fallbackCents)} / ${locale === "es" ? "año" : "year"}`;
}
