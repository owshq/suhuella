"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

type PaymentVerificationLoaderProps = {
  message: string;
};

export function PaymentVerificationLoader({
  message,
}: PaymentVerificationLoaderProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <GlassCard className="relative overflow-hidden border-white/80 bg-white/75 p-10 shadow-2xl shadow-blue-900/10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#0084FF]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-400/15 blur-3xl" />

          <div className="relative flex flex-col items-center gap-6">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#0084FF]/20"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-1 rounded-full border-2 border-t-[#0084FF] border-r-[#0084FF]/30 border-b-[#0084FF]/10 border-l-[#0084FF]/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
              <div className="h-3 w-3 rounded-full bg-[#0084FF] shadow-[0_0_16px_rgba(0,132,255,0.8)]" />
            </div>

            <p className="text-center text-base font-medium text-slate-700">
              {message}
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </main>
  );
}
