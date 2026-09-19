export type Locale = "es" | "en";

export type MockupSuggestion = {
  path: string;
  match: number;
  primary?: boolean;
};

export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  pageTitles: {
    download: string;
    license: string;
  };
  success: {
    title: string;
    verifiedTitle: string;
    description: string;
    downloadWindows: string;
    downloadMac: string;
    downloadCta: string;
    backHome: string;
    verifying: string;
    verifyingHint: string;
    missingSessionTitle: string;
    missingSessionDescription: string;
    invalidSessionTitle: string;
    invalidSessionDescription: string;
    unauthorizedTitle: string;
    unauthorizedDescription: string;
    retryPurchase: string;
    viewPlans: string;
    lifetimeUnavailable: string;
    monthlyUnavailable: string;
    planUnavailable: string;
    installersPending: string;
    mvpWarning: string;
    support: string;
    trayNote: string;
    installTitle: string;
    installSteps: string[];
    unsignedNote: string;
    downloadUnavailableTitle: string;
    downloadUnavailableDescription: string;
    licenseActivated: string;
    openApp: string;
    downloadIfMissing: string;
    paymentIncomplete: string;
    purchaseConfirmed: string;
    alreadyInstalled: string;
    continueInBrowser: string;
    checkoutCanceled: string;
    modalNoPurchaseTitle: string;
    modalNoPurchaseDescription: string;
  };
  hero: {
    badge: {
      name: string;
    };
    title: string;
    subtitle: string;
  };
  features: {
    eyebrow: string;
    title: string;
    items: Array<{
      title: string;
      description: string;
    }>;
  };
  welcomeModal: {
    title: string;
    body: string;
    start: string;
    viewPlans: string;
    howItWorks: string;
  };
  download: {
    title: string;
    subtitle: string;
    windows: string;
    mac: string;
    orBuy: string;
    trayNote: string;
    unavailable: string;
    comingSoon: string;
    catalogTitle: string;
    catalogSubtitle: string;
    catalogSubtitleWithMac: string;
    stateWebTitle: string;
    stateWebAvailable: string;
    stateWebAction: string;
    stateDesktopTitle: string;
    stateDesktopUnavailable: string;
    stateDesktopNoInstallers: string;
    stateMacTitle: string;
    stateMacAvailable: string;
    stateMacAction: string;
    stateWindowsTitle: string;
    stateWindowsUnavailable: string;
    catalogUnsignedNote: string;
    activationNote: string;
    viewPlans: string;
    tableVersion: string;
    tableChannel: string;
    tablePlatform: string;
    tableStatus: string;
    tableDate: string;
    tableAction: string;
    platformWeb: string;
    platformMac: string;
    platformWindows: string;
    statusAvailable: string;
    statusUnavailable: string;
    channelPreRc: string;
    channelStable: string;
    channelBeta: string;
    actionOpen: string;
    actionDownload: string;
    actionNone: string;
  };
  howItWorks: {
    title: string;
    steps: Array<{
      number: string;
      title: string;
      description: string;
    }>;
  };
  embeddings: {
    title: string;
    subtitle: string;
    models: string;
    stats: Array<{
      value: string;
      label: string;
    }>;
    statsNote: {
      title: string;
      description: string;
    };
  };
  privacy: {
    eyebrow: string;
    title: string;
    description: string;
  };
  faq: {
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  footer: {
    privacy: string;
    terms: string;
    support: string;
    copyright: string;
  };
  legal: {
    updated: string;
    privacyTitle: string;
    termsTitle: string;
    privacyParagraphs: string[];
    termsParagraphs: string[];
  };
  mockup: {
    fileName: string;
    badge: string;
    enterHint: string;
    saveAsHint: string;
    matchLabel: string;
    allOrganized: string;
    suggestions: MockupSuggestion[];
  };
};
