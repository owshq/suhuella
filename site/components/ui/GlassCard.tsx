import type { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/30 shadow-xl shadow-blue-900/5 backdrop-blur-xl ${className}`}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
