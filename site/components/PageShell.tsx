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
      <AnimatedMeshBackground landing={landing} />
      {children}
    </LocaleProvider>
  );
}
