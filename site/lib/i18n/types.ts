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
  };
  success: {
    title: string;
    description: string;
    downloadCta: string;
    backHome: string;
    verifying: string;
    unauthorizedTitle: string;
    unauthorizedDescription: string;
    retryPurchase: string;
    mvpWarning: string;
    support: string;
    trayNote: string;
  };
  hero: {
    badge: {
      name: string;
      latency: string;
      memory: string;
      version: string;
    };
    title: string;
    subtitle: string;
    cta: string;
  };
  features: {
    eyebrow: string;
    title: string;
    items: Array<{
      title: string;
      description: string;
    }>;
  };
  download: {
    title: string;
    subtitle: string;
    windows: string;
    mac: string;
    version: string;
    orBuy: string;
    trayNote: string;
  };
  howItWorks: {
    title: string;
    steps: Array<{
      number: string;
      title: string;
      description: string;
    }>;
  };
  privacy: {
    eyebrow: string;
    title: string;
    description: string;
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
    matchLabel: string;
    allOrganized: string;
    suggestions: MockupSuggestion[];
  };
};
