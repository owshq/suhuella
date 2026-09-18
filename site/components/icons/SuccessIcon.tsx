"use client";

import { motion } from "framer-motion";

type SuccessIconProps = {
  className?: string;
};

export function SuccessIcon({ className = "h-14 w-14 text-emerald-500" }: SuccessIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <motion.circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="2.5"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        d="M14 24.5 L21.2 31.2 L34.5 17.2"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.2, delay: 0.12 },
        }}
      />
    </svg>
  );
}
