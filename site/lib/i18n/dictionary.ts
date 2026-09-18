import type { Dictionary, Locale } from "./types";

const es: Dictionary = {
  meta: {
    title: "SuHuella — Guarda cada archivo en su sitio",
    description:
      "Utilidad de escritorio ultraligera que sugiere dónde guardar facturas y documentos. 100% privada e instantánea. Compra única.",
  },
  pageTitles: {
    download: "Descarga",
  },
  success: {
    title: "Tu pago se ha completado",
    description:
      "Gracias por comprar SuHuella. Descarga el instalador para Windows o Mac.",
    downloadCta: "Descargar SuHuella para Mac / Windows",
    backHome: "Volver al inicio",
    verifying: "Verificando tu pago…",
    unauthorizedTitle: "Acceso no autorizado",
    unauthorizedDescription:
      "No hemos podido verificar tu pago. Completa la compra para acceder a la descarga.",
    retryPurchase: "Reintentar compra",
    mvpWarning:
      "Esta versión es un MVP inicial. Algunas aplicaciones pueden no detectarse todavía.",
    support: "¿Necesitas ayuda? Escríbenos a support@suhuella.com",
    trayNote:
      "Funciona en silencio en la bandeja del sistema y solo aparece cuando lo necesitas.",
  },
  hero: {
    badge: {
      name: "SuHuella",
      latency: "Instantáneo",
      memory: "<50 MB RAM",
    },
    title: "Guarda tus archivos en la carpeta correcta. Al instante.",
    subtitle:
      "Una utilidad de escritorio ultraligera que aprende de tus hábitos y sugiere dónde guardar cada factura o documento sin salir de tu Mac o PC.",
  },
  features: {
    eyebrow: "Por qué SuHuella",
    title: "Privacidad, velocidad y simplicidad",
    items: [
      {
        title: "Privacidad Absoluta",
        description:
          "Tus archivos jamás suben a la nube. Todo se procesa de forma local en tu equipo.",
      },
      {
        title: "Cero Latencia",
        description:
          "Aparece justo cuando vas a guardar un archivo, sin esperas ni configuraciones complejas.",
      },
      {
        title: "Compra única",
        description:
          "Un solo pago, sin suscripciones. El importe se muestra en el checkout de Stripe.",
      },
    ],
  },
  download: {
    title: "Descarga directa",
    subtitle: "Instaladores firmados y listos para usar.",
    windows: "Windows",
    mac: "macOS",
    orBuy: "¿Aún no has comprado?",
    trayNote:
      "Funciona en silencio en la bandeja del sistema y solo aparece cuando lo necesitas.",
  },
  howItWorks: {
    title: "Simple por diseño. Inteligente por costumbre.",
    steps: [
      {
        number: "01",
        title: "Organiza una vez",
        description:
          "Guarda tus archivos en tus carpetas habituales como siempre lo haces, pero con ayuda.",
      },
      {
        number: "02",
        title: "La app memoriza",
        description:
          "Aprende según tu histórico y los nombres de archivo, todo en local en tu equipo.",
      },
      {
        number: "03",
        title: "Acierto instantáneo",
        description:
          "Te sugiere la carpeta exacta justo cuando vas a guardar el siguiente archivo.",
      },
    ],
  },
  privacy: {
    eyebrow: "Privacidad absoluta",
    title: "Tus documentos nunca salen de tu equipo",
    description:
      "SuHuella funciona 100% en local, sin bases de datos externas ni nubes. Tus facturas, contratos y archivos confidenciales permanecen bajo tu control en todo momento.",
  },
  footer: {
    privacy: "Privacidad",
    terms: "Términos",
    support: "support@suhuella.com",
    copyright: "© 2026 SuHuella",
  },
  legal: {
    updated: "Última actualización: septiembre 2026",
    privacyTitle: "Privacidad",
    termsTitle: "Términos",
    privacyParagraphs: [
      "SuHuella es una utilidad de escritorio que funciona en tu ordenador. Los nombres de archivo, las rutas de carpeta y tus ajustes se quedan en local.",
      "La app no sube documentos, nombres de archivo ni rutas de carpeta a ningún servidor, salvo que en el futuro actives de forma explícita una función en la nube.",
      "Los ajustes se guardan en un archivo local del equipo (settings.json en el directorio de datos de la app).",
      "El sitio web solo procesa el pago a través de Stripe y, tras un pago correcto, te muestra los instaladores. No creamos cuentas de usuario ni guardamos tu correo en una base de datos propia.",
      "Para cualquier duda: support@suhuella.com",
    ],
    termsParagraphs: [
      "SuHuella es una compra digital de pago único, sin suscripción. El importe final se muestra en el checkout de Stripe antes de pagar.",
      "Esta versión es un MVP inicial. El producto puede cambiar y algunas aplicaciones pueden no ser compatibles todavía.",
      "No garantizamos que SuHuella detecte el diálogo Guardar / Guardar como en todos los programas.",
      "La app solo sugiere una carpeta de destino. Tú confirmas el guardado con el botón nativo de Windows o macOS.",
      "Si necesitas un reembolso o tienes un problema con la descarga, escribe a support@suhuella.com.",
    ],
  },
  mockup: {
    fileName: "factura_servicios_marzo.pdf",
    badge: "100% Local · Zero Cloud · Instant",
    enterHint: "Enter",
    matchLabel: "match",
    allOrganized: "Todo organizado",
    suggestions: [
      {
        path: "Clients / TechCorp / 2026 / 03-Invoices",
        match: 98,
        primary: true,
      },
      {
        path: "Admin / Contabilidad / Q1-Gastos",
        match: 84,
      },
      {
        path: "Projects / Rediseño Web / Facturas",
        match: 71,
      },
    ],
  },
};

const en: Dictionary = {
  meta: {
    title: "SuHuella — Save every file in the right place",
    description:
      "Ultra-light desktop utility that suggests where to save invoices and documents. 100% private and instant. One-time purchase.",
  },
  pageTitles: {
    download: "Download",
  },
  success: {
    title: "Your payment was successful.",
    description:
      "Thank you for buying SuHuella. Download the installer for Windows or Mac.",
    downloadCta: "Download SuHuella for Mac / Windows",
    backHome: "Back to home",
    verifying: "Verifying your payment…",
    unauthorizedTitle: "Unauthorized access",
    unauthorizedDescription:
      "We couldn't verify your payment. Complete your purchase to access the download.",
    retryPurchase: "Retry purchase",
    mvpWarning:
      "This is an early MVP. Some applications may not be detected yet.",
    support: "Need help? Contact support@suhuella.com",
    trayNote:
      "Runs quietly in your system tray and only appears when you need it.",
  },
  hero: {
    badge: {
      name: "SuHuella",
      latency: "Instant",
      memory: "<50 MB RAM",
    },
    title: "Save files to the right folder. Instantly.",
    subtitle:
      "An ultra-light desktop utility that learns your habits and suggests where to save every invoice or document without leaving your Mac or PC.",
  },
  features: {
    eyebrow: "Why SuHuella",
    title: "Privacy, speed, and simplicity",
    items: [
      {
        title: "Absolute Privacy",
        description:
          "Your files never upload to the cloud. Everything is processed locally on your machine.",
      },
      {
        title: "Zero Latency",
        description:
          "Appears right when you're about to save a file — no waiting, no complex setup.",
      },
      {
        title: "One-time purchase",
        description:
          "Pay once, no subscription. The amount is shown in Stripe checkout.",
      },
    ],
  },
  download: {
    title: "Direct download",
    subtitle: "Signed installers, ready to use.",
    windows: "Windows",
    mac: "macOS",
    orBuy: "Haven't purchased yet?",
    trayNote:
      "Runs quietly in your system tray and only appears when you need it.",
  },
  howItWorks: {
    title: "Simple by design. Smart by habit.",
    steps: [
      {
        number: "01",
        title: "Organize once",
        description:
          "Save your files to your usual folders exactly as you always do — but with help.",
      },
      {
        number: "02",
        title: "The app remembers",
        description:
          "It learns from your history and file names, all locally on your machine.",
      },
      {
        number: "03",
        title: "Instant accuracy",
        description:
          "It suggests the exact folder right when you're about to save the next file.",
      },
    ],
  },
  privacy: {
    eyebrow: "Absolute privacy",
    title: "Your documents never leave your device",
    description:
      "SuHuella runs 100% locally, with no external databases or cloud services. Your invoices, contracts, and confidential files stay under your control at all times.",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    support: "support@suhuella.com",
    copyright: "© 2026 SuHuella",
  },
  legal: {
    updated: "Last updated: September 2026",
    privacyTitle: "Privacy",
    termsTitle: "Terms",
    privacyParagraphs: [
      "SuHuella is a desktop utility that runs on your computer. File names, folder paths, and settings stay local.",
      "The app does not upload documents, file names, or folder paths to any server unless you later enable a cloud feature explicitly.",
      "Settings are stored in a local file on your machine (settings.json in the app userData directory).",
      "This website only processes payment through Stripe and, after a successful payment, shows you the installers. We do not create user accounts or store your email in our own database.",
      "Questions: support@suhuella.com",
    ],
    termsParagraphs: [
      "SuHuella is a one-time digital purchase with no subscription. The final amount is shown in Stripe checkout before you pay.",
      "This version is an early MVP. The product may change, and some applications may not be compatible yet.",
      "We do not guarantee that SuHuella will detect the Save / Save As dialog in every application.",
      "The app only suggests a destination folder. You confirm the save with the native Windows or macOS Save button.",
      "If you need a refund or have a download problem, contact support@suhuella.com.",
    ],
  },
  mockup: {
    fileName: "factura_servicios_marzo.pdf",
    badge: "100% Local · Zero Cloud · Instant",
    enterHint: "Enter",
    matchLabel: "match",
    allOrganized: "All organized",
    suggestions: [
      {
        path: "Clients / TechCorp / 2026 / 03-Invoices",
        match: 98,
        primary: true,
      },
      {
        path: "Admin / Accounting / Q1-Expenses",
        match: 84,
      },
      {
        path: "Projects / Web Redesign / Invoices",
        match: 71,
      },
    ],
  },
};

export const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
