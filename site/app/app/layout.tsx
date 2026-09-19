import type { ReactNode } from "react";

export default function AppHostLayout({ children }: { children: ReactNode }) {
  return (
    <div data-suhuella-app className="min-h-screen bg-transparent text-[var(--app-fg)]">
      {children}
    </div>
  );
}
