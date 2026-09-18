"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type GlowButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function GlowButton({
  href,
  children,
  className = "",
  target,
  rel,
  onClick,
}: GlowButtonProps) {
  return (
    <motion.a
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[#0084FF] px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_20px_-10px_rgba(0,132,255,0.6)] transition-all duration-300 hover:shadow-[0_15px_30px_-10px_rgba(0,132,255,0.8)] md:px-10 md:py-4 md:text-lg ${className}`}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.a>
  );
}
