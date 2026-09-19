"use client";

import { AnimatedMeshBackground } from "@/components/AnimatedMeshBackground";
import { DocumentTitle } from "@/components/DocumentTitle";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  landing?: boolean;
};

export function PageShell({ children, landing = false }: PageShellProps) {
  return (
    <LocaleProvider>
      <DocumentTitle />
      <div className="landing-surface relative flex min-h-screen flex-col">
        <AnimatedMeshBackground landing={landing} />
        {children}
      </div>
    </LocaleProvider>
  );
}
