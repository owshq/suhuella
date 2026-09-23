import { applyBrandPresentationDeep } from "@suhuella/brand";
import type { Dictionary, Locale } from "./types";

const es: Dictionary = {
  meta: {
    title: "SuHuella — La carpeta correcta al guardar",
    description:
      "SuHuella Web te deja probar SuHuella en este dispositivo. Todo permanece en local. La app de escritorio estará disponible más adelante.",
  },
  pageTitles: {
    download: "Descarga",
    license: "Licencia",
  },
  success: {
    title: "Tu pago se ha completado",
    verifiedTitle: "Pago confirmado",
    description:
      "Gracias por tu compra. Elige tu plataforma e instala SuHuella en un minuto.",
    downloadWindows: "Descargar SuHuella para Windows",
    downloadMac: "Descargar SuHuella para macOS",
    downloadCta: "Descargar SuHuella",
    backHome: "Volver al inicio",
    verifying: "Confirmando tu pago",
    verifyingHint: "Solo un momento.",
    missingSessionTitle: "Esta página es solo después de pagar",
    missingSessionDescription:
      "Completa la compra para descargar SuHuella. Si ya pagaste, abre el enlace de tu recibo o escríbenos a support@suhuella.com.",
    invalidSessionTitle: "No hemos podido confirmar este pago",
    invalidSessionDescription:
      "Puedes seguir: vuelve a intentarlo o escríbenos a support@suhuella.com. Si ya pagaste, te ayudamos con la descarga.",
    unauthorizedTitle: "No hemos podido confirmar tu compra",
    unauthorizedDescription:
      "Completa la compra para descargar SuHuella. Si ya pagaste, escríbenos a support@suhuella.com.",
    retryPurchase: "Ver planes",
    viewPlans: "Ver planes",
    lifetimeUnavailable: "Lifetime aún no está disponible.",
    monthlyUnavailable: "Monthly aún no está disponible.",
    planUnavailable: "Este plan aún no está disponible.",
    installersPending:
      "Tu pago está confirmado. El instalador aún no está listo. Puedes seguir: escríbenos a support@suhuella.com y te lo enviamos.",
    mvpWarning:
      "Versión inicial: algunas aplicaciones pueden no mostrar sugerencias todavía. Puedes seguir guardando como siempre.",
    support: "¿Necesitas ayuda? support@suhuella.com",
    trayNote:
      "Al abrir SuHuella aparece la ventana. Si la cierras, sigue en la bandeja y continúa aprendiendo.",
    installTitle: "Qué hacer ahora",
    installSteps: [
      "Descarga el instalador de tu sistema.",
      "Si Windows o macOS avisan que no está firmado, continúa: Más información → Ejecutar de todos modos, o clic derecho → Abrir.",
      "Abre SuHuella. Aparece la ventana principal.",
      "Añade las carpetas que ya usas y sigue guardando. Si cierras la ventana, SuHuella sigue en la bandeja.",
    ],
    unsignedNote:
      "El instalador aún no está firmado. La advertencia del sistema es esperada. Luego abre SuHuella: aparece la ventana.",
    downloadUnavailableTitle: "La descarga aún no está lista",
    downloadUnavailableDescription:
      "Tu pago está confirmado. El instalador no está listo todavía. Puedes seguir: escríbenos a support@suhuella.com y te lo enviamos.",
    licenseActivated: "Licencia activada",
    openApp: "Abrir SuHuella",
    downloadIfMissing: "Si SuHuella no se abre, descárgala e instálala.",
    paymentIncomplete: "El pago no se ha completado.",
    purchaseConfirmed: "Compra confirmada",
    alreadyInstalled: "¿Ya está instalada? Abre SuHuella para activar este dispositivo.",
    continueInBrowser: "Usar SuHuella en este navegador",
    checkoutCanceled: "Checkout cancelado. Tu plan no ha cambiado.",
    modalNoPurchaseTitle: "No hay ninguna compra que confirmar",
    modalNoPurchaseDescription:
      "No hemos podido verificar una sesión de checkout. Puedes seguir usando SuHuella Web o ver los planes.",
  },
  welcomeModal: {
    title: "Organiza documentos sin perder el control",
    body: "SuHuella aprende de las carpetas que tú eliges y sugiere dónde guardar u organizar documentos. Tus archivos permanecen en este dispositivo. Nada se mueve sin tu confirmación.",
    start: "Empezar",
    viewPlans: "Ver planes",
    howItWorks: "¿Cómo funciona?",
  },
  hero: {
    badge: {
      name: "SuHuella",
    },
    title: "Guarda tus archivos en la carpeta correcta. Al instante.",
    subtitle:
      "SuHuella Web te deja probarla en este dispositivo. Todo permanece en local. La app de escritorio dará la experiencia nativa más adelante.",
  },
  features: {
    eyebrow: "Producto",
    title: "IA local que recomienda, sin ceder tu privacidad",
    subtitle: "Un modelo empaquetado en tu dispositivo. Tú confirmas cada acción.",
    items: [
      {
        title: "Modelo de IA empaquetado en local",
        description:
          "Un modelo ligero incluido en la app corre en tu dispositivo de forma segura. Entiende nombres y contexto para recomendar la carpeta correcta — sin enviar el contenido de tus archivos.",
      },
      {
        title: "Recomienda según tus hábitos",
        description:
          "Aprende de dónde guardas cada tipo de archivo y mejora con cada confirmación. Las sugerencias se adaptan a cómo trabajas.",
      },
      {
        title: "Privacidad por diseño",
        description:
          "Todo permanece en tu equipo. Sin nube obligatoria, sin subir documentos. SuHuella funciona sin conexión.",
      },
      {
        title: "Web ahora, escritorio nativo",
        description:
          "Pruébala en este navegador hoy. La app de escritorio se integra al guardar para sugerencias al instante.",
      },
    ],
  },
  download: {
    title: "Descarga SuHuella",
    subtitle: "Instálalo en un minuto. Luego sigue guardando como siempre.",
    windows: "Windows",
    mac: "macOS",
    orBuy: "¿Aún no has comprado?",
    trayNote:
      "Al abrirla aparece la ventana. Si la cierras, sigue en la bandeja.",
    unavailable: "Aún no disponible",
    comingSoon: "La app de escritorio estará disponible pronto. Mientras tanto, ábrela en este navegador.",
    catalogTitle: "Descargas de SuHuella",
    catalogLatestLabel: "Versión actual",
    catalogArchiveTitle: "Versiones anteriores",
    catalogTableTitle: "Todas las descargas",
    catalogSubtitle:
      "Aquí aparecerán las versiones públicas de SuHuella Desktop cuando estén disponibles. Mientras tanto, puedes usar SuHuella Web en este navegador.",
    catalogSubtitleWithMac:
      "La descarga es pública. Al abrir la app, la licencia comprueba edición y capacidades.",
    stateWebTitle: "SuHuella Web",
    stateWebAvailable: "Disponible ahora",
    stateWebAction: "Abrir SuHuella",
    stateDesktopTitle: "SuHuella Desktop",
    stateDesktopUnavailable: "Todavía no disponible.",
    stateDesktopNoInstallers:
      "No hay instaladores públicos para Mac o Windows en este momento.",
    stateMacTitle: "SuHuella Desktop Mac",
    stateMacAvailable: "Disponible",
    stateMacAction: "Descargar para Mac",
    stateWindowsTitle: "SuHuella Desktop Windows",
    stateWindowsAvailable: "Disponible",
    stateWindowsAction: "Descargar para Windows",
    stateWindowsUnavailable: "Aún no disponible",
    catalogUnsignedNote:
      "macOS puede mostrar un aviso de seguridad porque esta build no está notarizada.",
    activationNote:
      "Puedes descargar una versión pública cuando esté disponible. Al abrir SuHuella, la licencia comprueba edición, dispositivos y capacidades.",
    viewPlans: "Ver planes",
    tableVersion: "Versión",
    tableSize: "Tamaño",
    tablePlatform: "Plataforma",
    tableStatus: "Estado",
    tableDate: "Fecha",
    tableAction: "Acción",
    platformWeb: "Web",
    platformMac: "Mac",
    platformWindows: "Windows",
    statusAvailable: "Disponible",
    statusUnavailable: "No disponible",
    channelPreRc: "Beta",
    channelStable: "stable",
    channelBeta: "beta",
    actionOpen: "Abrir",
    actionDownload: "Descargar",
    actionNone: "—",
  },
  downloadPreparing: {
    title: "Preparando tu descarga…",
    preparingStarted: "Estamos iniciando la descarga.",
    autoStarted: "La descarga debería empezar automáticamente.",
    retryHint: "Si no empieza en unos segundos, usa el botón de abajo.",
    downloadAgain: "Descargar de nuevo",
    installTitle: "Instalar SuHuella",
    steps: [
      "Abre el archivo descargado.",
      "Sigue las instrucciones de instalación en tu dispositivo.",
      "Abre SuHuella.",
      "Inicia sesión o activa tu licencia.",
    ],
    installHintMac: "Mueve SuHuella a la carpeta Aplicaciones.",
    installHintWindows: "Ejecuta el instalador y sigue el asistente.",
    otherPlatformsTitle: "¿Buscas otra plataforma?",
    platformMac: "Descargar para macOS",
    platformWindows: "Descargar para Windows",
    allDownloads: "Ver todas las descargas",
    openWeb: "Abrir SuHuella en este navegador",
  },
  howItWorks: {
    eyebrow: "App de escritorio",
    title: "Simple. Recomienda según tus hábitos.",
    subtitle:
      "Aprende cómo guardas tus archivos y te sugiere la carpeta correcta cada vez — en local, en tu equipo.",
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
  embeddings: {
    title: "La carpeta correcta, cada vez",
    subtitle:
      "SuHuella te sugiere una carpeta. Tú confirmas. Todo permanece en este dispositivo.",
    models: "En este dispositivo · Todo permanece en local",
    stats: [
      { value: "Local", label: "En este dispositivo" },
      { value: "Tuya", label: "Tú tienes el control" },
      { value: "Después", label: "Escritorio más adelante" },
    ],
    statsNote: {
      title: "Ahora en el navegador",
      description:
        "SuHuella Web trabaja en este dispositivo. La app de escritorio dará la experiencia nativa más adelante.",
    },
  },
  privacy: {
    eyebrow: "Privacidad",
    title: "Todo permanece en tu ordenador",
    description:
      "SuHuella Web funciona en este dispositivo. El contenido de tus archivos no se envía. La app de escritorio dará la experiencia nativa más adelante.",
  },
  faq: {
    title: "Preguntas frecuentes",
    items: [
      {
        question: "¿Qué hace la IA en mi dispositivo?",
        answer:
          "SuHuella incluye un modelo empaquetado que corre en local. Analiza nombres de archivo y tu historial de carpetas para recomendar dónde guardar — de forma segura, sin subir el contenido.",
      },
      {
        question: "¿SuHuella guarda o mueve archivos por mí?",
        answer:
          "No. Sugiere la carpeta y tú confirmas. En el navegador lo haces desde Modo Plan. Tú sigues en control.",
      },
      {
        question: "¿Mis documentos salen de este ordenador?",
        answer:
          "No. El contenido de tus archivos permanece en este dispositivo. No hay nube obligatoria.",
      },
      {
        question: "¿Cómo aprende mis hábitos?",
        answer:
          "Cuando confirmas una sugerencia, SuHuella recuerda la relación entre tipo de archivo y carpeta. Todo se guarda en local en tu equipo.",
      },
      {
        question: "¿Puedo usar SuHuella ahora?",
        answer:
          "Sí, en este navegador. La app de escritorio para macOS y Windows ofrece la experiencia nativa completa cuando la instales.",
      },
    ],
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
      "SuHuella se puede usar ahora en el navegador. Los nombres de archivo, las rutas de carpeta y tus ajustes se quedan en este dispositivo.",
      "La app no sube documentos, nombres de archivo ni rutas de carpeta a ningún servidor, salvo que en el futuro actives de forma explícita una función en la nube.",
      "Los ajustes se guardan en este dispositivo.",
      "Este sitio no ofrece instaladores de escritorio ahora. Cuando el pago esté disponible, se procesa a través de Stripe. No creamos cuentas de usuario ni guardamos tu correo en una base de datos propia.",
      "Para cualquier duda: support@suhuella.com",
    ],
    termsParagraphs: [
      "Lifetime y Monthly se pagan en Stripe Checkout. El importe final se muestra antes de pagar.",
      "Esta es una versión inicial. El producto puede cambiar y algunas aplicaciones pueden no ser compatibles todavía.",
      "No garantizamos que la app de escritorio, cuando exista, detecte la ventana Guardar / Guardar como en todos los programas.",
      "SuHuella sugiere una carpeta de destino y tú confirmas. En el navegador lo haces desde Modo Plan. SuHuella no mueve archivos por ti.",
      "Si necesitas un reembolso o tienes un problema, escribe a support@suhuella.com.",
    ],
  },
  mockup: {
    fileName: "factura_servicios_marzo.pdf",
    badge: "Todo permanece en tu ordenador",
    enterHint: "Enter",
    saveAsHint: "Guardar como…",
    matchLabel: "",
    allOrganized: "Todo organizado",
    suggestions: [
      { path: "Finance / 2026", match: 97 },
      { path: "Projects / Design", match: 79 },
      { path: "Clients / TechCorp / Invoices", match: 72 },
      { path: "Admin / Contabilidad", match: 65 },
      { path: "Archive", match: 63 },
      { path: "Legal / Contracts", match: 51 },
      { path: "Personal / Receipts", match: 49 },
    ],
  },
};

const en: Dictionary = {
  meta: {
    title: "SuHuella — The right folder when you save",
    description:
      "SuHuella Web lets you try SuHuella on this device. Everything stays local. The desktop app is coming later.",
  },
  pageTitles: {
    download: "Download",
    license: "License",
  },
  success: {
    title: "Your payment was successful",
    verifiedTitle: "Payment confirmed",
    description:
      "Thank you for your purchase. Choose your platform and install SuHuella in a minute.",
    downloadWindows: "Download SuHuella for Windows",
    downloadMac: "Download SuHuella for macOS",
    downloadCta: "Download SuHuella",
    backHome: "Back to home",
    verifying: "Confirming your payment",
    verifyingHint: "This only takes a moment.",
    missingSessionTitle: "This page is only after you pay",
    missingSessionDescription:
      "Complete your purchase to download SuHuella. If you already paid, open the link from your receipt or email support@suhuella.com.",
    invalidSessionTitle: "We could not confirm this payment",
    invalidSessionDescription:
      "You can continue: try again or email support@suhuella.com. If you already paid, we will help you get the download.",
    unauthorizedTitle: "We could not confirm your purchase",
    unauthorizedDescription:
      "Complete your purchase to download SuHuella. If you already paid, email support@suhuella.com.",
    retryPurchase: "View plans",
    viewPlans: "View plans",
    lifetimeUnavailable: "Lifetime is not available yet.",
    monthlyUnavailable: "Monthly is not available yet.",
    planUnavailable: "This plan is not available yet.",
    installersPending:
      "Your payment is confirmed. The installer is not ready yet. You can continue: email support@suhuella.com and we will send it to you.",
    mvpWarning:
      "Early version: some apps may not show suggestions yet. You can keep saving as usual.",
    support: "Need help? support@suhuella.com",
    trayNote:
      "Opening SuHuella shows the window. Close it and SuHuella stays in the tray and keeps learning.",
    installTitle: "What to do next",
    installSteps: [
      "Download the installer for your system.",
      "If Windows or macOS warns that it is unsigned, continue: More info → Run anyway, or right-click → Open.",
      "Open SuHuella. The main window appears.",
      "Add the folders you already use, then keep saving. Close the window and SuHuella stays in the tray.",
    ],
    unsignedNote:
      "The installer is not signed yet. The system warning is expected. Then open SuHuella — the window appears.",
    downloadUnavailableTitle: "The download is not ready yet",
    downloadUnavailableDescription:
      "Your payment is confirmed. The installer is not ready yet. You can continue: email support@suhuella.com and we will send it to you.",
    licenseActivated: "License activated",
    openApp: "Open SuHuella",
    downloadIfMissing: "If SuHuella does not open, download and install it.",
    paymentIncomplete: "Payment was not completed.",
    purchaseConfirmed: "Purchase confirmed",
    alreadyInstalled: "Already installed? Open SuHuella to activate this device.",
    continueInBrowser: "Use SuHuella in this browser",
    checkoutCanceled: "Checkout canceled. Your plan is unchanged.",
    modalNoPurchaseTitle: "No purchase to confirm",
    modalNoPurchaseDescription:
      "We could not verify a checkout session. You can continue using SuHuella Web or view plans.",
  },
  welcomeModal: {
    title: "Plan documents without losing control",
    body: "SuHuella learns from the folders you choose and suggests where to save or organise documents. Your files stay on this device. Nothing moves without your confirmation.",
    start: "Get started",
    viewPlans: "View plans",
    howItWorks: "How it works",
  },
  hero: {
    badge: {
      name: "SuHuella",
    },
    title: "Save files to the right folder. Instantly.",
    subtitle:
      "SuHuella Web lets you try it on this device. Everything stays local. The desktop app will provide the full native experience later.",
  },
  features: {
    eyebrow: "Product",
    title: "Local AI that recommends — without giving up privacy",
    subtitle: "A packaged model on your device. You confirm every action.",
    items: [
      {
        title: "Packaged AI, on your device",
        description:
          "A lightweight model built into the app runs locally and securely. It reads file names and context to recommend the right folder — without uploading your file contents.",
      },
      {
        title: "Recommendations from your habits",
        description:
          "It learns where you save each kind of file and improves with every confirmation. Suggestions adapt to how you work.",
      },
      {
        title: "Privacy by design",
        description:
          "Everything stays on your machine. No required cloud, no document uploads. SuHuella works offline.",
      },
      {
        title: "Web now, native desktop",
        description:
          "Try it in this browser today. The desktop app hooks into Save for instant suggestions.",
      },
    ],
  },
  download: {
    title: "Download SuHuella",
    subtitle: "Install in a minute. Then keep saving as usual.",
    windows: "Windows",
    mac: "macOS",
    orBuy: "Haven't purchased yet?",
    trayNote:
      "Opening it shows the window. Close it and it stays in the tray.",
    unavailable: "Not ready yet",
    comingSoon: "The desktop app is coming soon. Until then, open SuHuella in this browser.",
    catalogTitle: "SuHuella downloads",
    catalogLatestLabel: "Current release",
    catalogArchiveTitle: "Previous versions",
    catalogTableTitle: "All downloads",
    catalogSubtitle:
      "Public SuHuella Desktop versions will appear here when they are available. For now, you can use SuHuella Web in this browser.",
    catalogSubtitleWithMac:
      "The download is public. When you open the app, the license checks edition and capabilities.",
    stateWebTitle: "SuHuella Web",
    stateWebAvailable: "Available now",
    stateWebAction: "Open SuHuella",
    stateDesktopTitle: "SuHuella Desktop",
    stateDesktopUnavailable: "Not available yet.",
    stateDesktopNoInstallers:
      "There are no public Mac or Windows installers yet.",
    stateMacTitle: "SuHuella Desktop Mac",
    stateMacAvailable: "Available",
    stateMacAction: "Download for Mac",
    stateWindowsTitle: "SuHuella Desktop Windows",
    stateWindowsAvailable: "Available",
    stateWindowsAction: "Download for Windows",
    stateWindowsUnavailable: "Not available yet",
    catalogUnsignedNote:
      "macOS may show a security warning because this build is not notarized.",
    activationNote:
      "You can download a public version when it is available. When you open SuHuella, the license checks edition, devices, and capabilities.",
    viewPlans: "View plans",
    tableVersion: "Version",
    tableSize: "Size",
    tablePlatform: "Platform",
    tableStatus: "Status",
    tableDate: "Date",
    tableAction: "Action",
    platformWeb: "Web",
    platformMac: "Mac",
    platformWindows: "Windows",
    statusAvailable: "Available",
    statusUnavailable: "Not available yet",
    channelPreRc: "Beta",
    channelStable: "stable",
    channelBeta: "beta",
    actionOpen: "Open",
    actionDownload: "Download",
    actionNone: "—",
  },
  downloadPreparing: {
    title: "Preparing your download…",
    preparingStarted: "Starting your download.",
    autoStarted: "Your download should start automatically.",
    retryHint: "If it doesn't start within a few seconds, use the button below.",
    downloadAgain: "Download again",
    installTitle: "Installing SuHuella",
    steps: [
      "Open the downloaded file.",
      "Follow the installation instructions on your device.",
      "Launch SuHuella.",
      "Sign in or activate your licence.",
    ],
    installHintMac: "Move SuHuella to the Applications folder.",
    installHintWindows: "Run the installer and follow the setup wizard.",
    otherPlatformsTitle: "Looking for another platform?",
    platformMac: "Download for macOS",
    platformWindows: "Download for Windows",
    allDownloads: "View all downloads",
    openWeb: "Open SuHuella in this browser",
  },
  howItWorks: {
    eyebrow: "Desktop app",
    title: "Simple. Recommends from your habits.",
    subtitle:
      "It learns how you save files and suggests the right folder every time — locally, on your machine.",
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
  embeddings: {
    title: "The right folder, every time",
    subtitle:
      "SuHuella suggests a folder. You confirm. Everything stays on this device.",
    models: "On this device · Everything stays local",
    stats: [
      { value: "Local", label: "On this device" },
      { value: "Yours", label: "You stay in control" },
      { value: "Later", label: "Desktop coming later" },
    ],
    statsNote: {
      title: "In the browser now",
      description:
        "SuHuella Web works on this device. The desktop app will provide the full native experience later.",
    },
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Everything stays on your computer",
    description:
      "SuHuella Web runs on this device. File contents are not sent away. The desktop app will provide the full native experience later.",
  },
  faq: {
    title: "Questions",
    items: [
      {
        question: "What does the AI do on my device?",
        answer:
          "SuHuella includes a packaged model that runs locally. It reads file names and your folder history to recommend where to save — securely, without uploading file contents.",
      },
      {
        question: "Does SuHuella save or move files for me?",
        answer:
          "No. It suggests the folder and you confirm. In the browser you do that from Plan Mode. You stay in control.",
      },
      {
        question: "Do my documents leave this computer?",
        answer:
          "No. File contents stay on this device. There is no required cloud.",
      },
      {
        question: "How does it learn my habits?",
        answer:
          "When you confirm a suggestion, SuHuella remembers the link between file type and folder. Everything is stored locally on your machine.",
      },
      {
        question: "Can I use SuHuella now?",
        answer:
          "Yes, in this browser. The desktop app for macOS and Windows gives you the full native experience when you install it.",
      },
    ],
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
      "SuHuella can be used in the browser now. File names, folder paths, and settings stay on this device.",
      "The app does not upload documents, file names, or folder paths to any server unless you later enable a cloud feature explicitly.",
      "Settings stay on this device.",
      "This website does not offer desktop installers now. When payment is available, it is processed through Stripe. We do not create user accounts or store your email in our own database.",
      "Questions: support@suhuella.com",
    ],
    termsParagraphs: [
      "Lifetime and Monthly are paid on Stripe Checkout. The final amount is shown before you pay.",
      "This is an early version. The product may change, and some apps may not work yet.",
      "We do not guarantee that the desktop app, when it exists, will detect the Save / Save As window in every application.",
      "SuHuella suggests a destination folder and you confirm. In the browser you do that from Plan Mode. SuHuella does not move files for you.",
      "If you need a refund or have a problem, contact support@suhuella.com.",
    ],
  },
  mockup: {
    fileName: "factura_servicios_marzo.pdf",
    badge: "Everything stays on your computer",
    enterHint: "Enter",
    saveAsHint: "Save As…",
    matchLabel: "",
    allOrganized: "All organized",
    suggestions: [
      { path: "Finance / 2026", match: 97 },
      { path: "Projects / Design", match: 79 },
      { path: "Clients / TechCorp / Invoices", match: 72 },
      { path: "Admin / Accounting", match: 65 },
      { path: "Archive", match: 63 },
      { path: "Legal / Contracts", match: 51 },
      { path: "Personal / Receipts", match: 49 },
    ],
  },
};

export const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return applyBrandPresentationDeep(dictionaries[locale]);
}
