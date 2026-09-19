import type { ReactNode } from "react";

export default function SuhuellaShellLayout({ children }: { children: ReactNode }) {
  return (
    <div data-suhuella-app className="h-dvh overflow-hidden bg-[var(--app-bg)] text-[var(--app-fg)]">
      {children}
    </div>
  );
}
