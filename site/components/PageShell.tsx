"use client";

import { AnimatedMeshBackground } from "@/components/AnimatedMeshBackground";
import { DocumentTitle } from "@/components/DocumentTitle";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  landing?: boolean;
  /** Allow vertical scroll inside the fixed app shell (marketing / partner pages). */
  scrollable?: boolean;
  /** Respect system light/dark on marketing surfaces (partner program, portal). */
  themeAdaptive?: boolean;
};

export function PageShell({
  children,
  landing = false,
  scrollable = false,
  themeAdaptive = false,
}: PageShellProps) {
  return (
    <LocaleProvider>
      <DocumentTitle />
      <div
        className={`landing-surface relative flex min-h-screen flex-col ${
          scrollable ? "max-h-dvh overflow-y-auto overscroll-y-contain" : ""
        }`}
        {...(themeAdaptive ? { "data-theme-adaptive": "" } : {})}
      >
        <AnimatedMeshBackground landing={landing} themeAdaptive={themeAdaptive} />
        {children}
      </div>
    </LocaleProvider>
  );
}
