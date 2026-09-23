import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Operations — SuHuella" },
  description: "SuHuella operations control center",
  robots: { index: false, follow: false, nocache: true },
};

export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100">{children}</div>
  );
}
