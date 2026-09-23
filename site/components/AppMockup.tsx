"use client";

import { AnimatePresence, motion, useSpring } from "framer-motion";
import { CheckCircle2, FileText, Folder, MousePointer2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";

type Phase = "idle" | "cursor" | "click" | "transfer";

const docs = [
  {
    id: 1,
    name: "invoice_march.pdf",
    folderId: "f1",
    icon: FileText,
    color: "text-rose-500",
  },
  {
    id: 2,
    name: "design_v2.fig",
    folderId: "f2",
    icon: FileText,
    color: "text-purple-500",
  },
  {
    id: 3,
    name: "budget_2026.xlsx",
    folderId: "f1",
    icon: FileText,
    color: "text-emerald-500",
  },
];

const folderMeta = [
  { id: "f1", name: "Finance / 2026" },
  { id: "f2", name: "Projects / Design" },
  { id: "f3", name: "Clients / TechCorp / Invoices" },
  { id: "f4", name: "Admin / Contabilidad" },
  { id: "f5", name: "Legal / Contracts" },
  { id: "f6", name: "Archive" },
  { id: "f7", name: "Personal / Receipts" },
  { id: "f8", name: "Tax / Returns" },
  { id: "f9", name: "HR / Onboarding" },
  { id: "f10", name: "Suppliers / Acme" },
];

const matchByDoc: Record<number, Record<string, number>> = {
  1: { f1: 98, f2: 71, f3: 68, f4: 62, f5: 55, f6: 58, f7: 44, f8: 41, f9: 38, f10: 35 },
  2: { f1: 74, f2: 96, f3: 69, f4: 58, f5: 52, f6: 61, f7: 47, f8: 43, f9: 40, f10: 36 },
  3: { f1: 97, f2: 79, f3: 72, f4: 65, f5: 51, f6: 63, f7: 49, f8: 45, f9: 42, f10: 37 },
};

const defaultMatches: Record<string, number> = {
  f1: 91,
  f2: 78,
  f3: 74,
  f4: 67,
  f5: 59,
  f6: 52,
  f7: 46,
  f8: 42,
  f9: 39,
  f10: 36,
};

const PHASE_MS: Record<Phase, number> = {
  idle: 280,
  cursor: 520,
  click: 180,
  transfer: 360,
};

const ORGANIZED_MS = 520;

const springCursor = {
  type: "spring" as const,
  stiffness: 140,
  damping: 18,
  mass: 0.55,
};

const snapEase = [0.22, 1, 0.36, 1] as const;

function DocumentSkeleton({ accent }: { accent: string }) {
  return (
    <div className="mt-3 flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 shadow-inner">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className={`h-2 w-2 rounded-full ${accent}`} />
        <div className="h-2 flex-1 rounded-full bg-slate-200/80" />
        <div className="h-2 w-8 rounded-full bg-slate-200/60" />
      </div>

      <div className="mb-2 h-2.5 w-3/4 rounded-full bg-slate-300/70" />
      <div className="mb-1.5 h-2 w-full rounded-full bg-slate-200/80" />
      <div className="mb-1.5 h-2 w-[92%] rounded-full bg-slate-200/70" />
      <div className="mb-4 h-2 w-[78%] rounded-full bg-slate-200/60" />

      <div className="mt-auto space-y-2 rounded-lg bg-slate-50 p-2.5">
        <div className="flex gap-2">
          <div className="h-2 w-1/4 rounded bg-slate-200/80" />
          <div className="h-2 w-1/3 rounded bg-slate-200/60" />
          <div className="h-2 w-1/5 rounded bg-slate-200/50" />
        </div>
        <div className="flex gap-2">
          <div className="h-2 w-1/5 rounded bg-slate-200/70" />
          <div className="h-2 w-2/5 rounded bg-slate-200/80" />
          <div className="h-2 w-1/4 rounded bg-slate-200/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-2 w-1/3 rounded bg-slate-200/60" />
          <div className="h-2 w-1/4 rounded bg-slate-200/50" />
          <div className="h-2 w-1/3 rounded bg-slate-200/70" />
        </div>
      </div>
    </div>
  );
}

type DocItem = (typeof docs)[number];

function DocumentCard({
  doc,
  className = "",
}: {
  doc: DocItem;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-white/70 bg-white/95 p-3 shadow-md ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-white p-2 shadow-sm">
          <doc.icon className={`h-5 w-5 ${doc.color}`} />
        </div>
        <span className="truncate text-xs font-semibold text-slate-700 md:text-sm">
          {doc.name}
        </span>
      </div>
      <DocumentSkeleton accent={doc.color.replace("text-", "bg-")} />
    </div>
  );
}

export function AppMockup() {
  const { t } = useLocale();
  const [activeDoc, setActiveDoc] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [flyingDoc, setFlyingDoc] = useState<DocItem | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topMatchRef = useRef<HTMLDivElement>(null);

  const allOrganized = activeDoc >= docs.length;
  const currentDoc = allOrganized ? undefined : docs[activeDoc];

  const suggestions = useMemo(() => {
    const scores = allOrganized
      ? defaultMatches
      : currentDoc
        ? (matchByDoc[currentDoc.id] ?? defaultMatches)
        : defaultMatches;

    return folderMeta
      .map((folder) => ({
        ...folder,
        match: scores[folder.id] ?? 40,
      }))
      .sort((a, b) => b.match - a.match);
  }, [currentDoc, allOrganized]);

  const isSelecting = phase === "cursor" || phase === "click";
  const showCursor = isSelecting && !allOrganized;

  const cursorX = useSpring(90, springCursor);
  const cursorY = useSpring(-48, springCursor);

  useEffect(() => {
    if (!showCursor) return;
    cursorX.set(phase === "click" ? 10 : phase === "cursor" ? 20 : 90);
    cursorY.set(phase === "click" ? 30 : phase === "cursor" ? 14 : -48);
  }, [showCursor, phase, cursorX, cursorY]);

  useEffect(() => {
    if (allOrganized) {
      const reset = setTimeout(() => {
        setActiveDoc(0);
        setFlyingDoc(null);
        setPhase("idle");
      }, ORGANIZED_MS);
      return () => clearTimeout(reset);
    }

    const timer = setTimeout(() => {
      setPhase((prev) => {
        if (prev === "idle") return "cursor";
        if (prev === "cursor") return "click";
        if (prev === "click") {
          const doc = docs[activeDoc];
          if (doc) setFlyingDoc(doc);
          if (activeDoc < docs.length - 1) {
            setActiveDoc((d) => d + 1);
          }
          return "transfer";
        }
        if (prev === "transfer") {
          setFlyingDoc((flying) => {
            if (flying?.id === docs[docs.length - 1].id) {
              setActiveDoc(docs.length);
            }
            return null;
          });
          return "idle";
        }
        return "idle";
      });
    }, PHASE_MS[phase]);

    return () => clearTimeout(timer);
  }, [phase, allOrganized, activeDoc]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeDoc, phase]);

  useEffect(() => {
    if (allOrganized || phase !== "idle") return;

    const interval = setInterval(() => {
      setScrollOffset((prev) => {
        const max = scrollRef.current
          ? scrollRef.current.scrollHeight - scrollRef.current.clientHeight
          : 0;
        if (max <= 0) return 0;
        const next = prev + 1.2;
        return next >= max ? 0 : next;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [allOrganized, phase]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollOffset;
    }
  }, [scrollOffset]);

  return (
    <div
      aria-hidden
      className="pointer-events-none relative mx-auto flex w-full max-w-3xl select-none items-center justify-center pt-6 pb-2 md:pt-8 md:pb-3"
    >
      <motion.div
        className="absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-accent)] md:h-[400px] md:w-[400px] lg:h-[440px] lg:w-[440px]"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-end justify-center gap-5 md:gap-8">
        {/* Documents */}
        <div className="relative w-[190px] overflow-visible rounded-[2rem] border border-white/60 bg-white/50 shadow-2xl backdrop-blur-xl md:w-[220px]">
          <div className="relative flex min-h-[260px] flex-col p-4 md:min-h-[300px] md:p-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {!allOrganized && currentDoc && (
                <motion.div
                  key={currentDoc.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.28, ease: snapEase }}
                  className="relative z-0 h-full"
                >
                  <DocumentCard doc={currentDoc} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {flyingDoc && (
                <motion.div
                  key={`fly-${flyingDoc.id}`}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{ opacity: 0, x: 130, y: -18, scale: 0.38 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.36, ease: snapEase }}
                  className="pointer-events-none absolute inset-4 z-20"
                >
                  <DocumentCard doc={flyingDoc} className="shadow-xl" />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {allOrganized && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.22, ease: snapEase }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <CheckCircle2 className="mb-2 h-9 w-9 text-[var(--brand-accent)]" />
                  <p className="text-center text-xs font-semibold text-slate-600">
                    {t.mockup.allOrganized}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Folder suggestions — auto-scroll is decorative; never captures pointer/wheel */}
        <div className="relative mt-8 w-[210px] rounded-[2rem] border border-white/10 bg-[#141414]/90 shadow-2xl backdrop-blur-xl md:mt-10 md:w-[260px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 rounded-t-[2rem] bg-gradient-to-b from-[#141414] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 rounded-b-[2rem] bg-gradient-to-t from-[#141414] to-transparent" />

          <div className="relative min-h-[260px] md:min-h-[300px]">
            <div
              ref={scrollRef}
              className="pointer-events-none scrollbar-none max-h-[260px] space-y-2 overflow-y-auto p-4 md:max-h-[300px] md:space-y-2.5 md:p-5"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {suggestions.map((folder, index) => {
                const isTopMatch = index === 0;
                const isHovered = isSelecting && isTopMatch;
                const isClicked = phase === "click" && isTopMatch;
                const isReceiving =
                  (phase === "transfer" || phase === "click") &&
                  isTopMatch &&
                  !allOrganized;

                return (
                  <motion.div
                    key={folder.id}
                    ref={isTopMatch ? topMatchRef : undefined}
                    layout
                    animate={{
                      scale: isReceiving ? 1.05 : isHovered ? 1.02 : 1,
                      backgroundColor: isReceiving
                        ? "color-mix(in srgb, var(--brand-accent) 24%, transparent)"
                        : isHovered
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(255,255,255,0.05)",
                      borderColor: isReceiving
                        ? "color-mix(in srgb, var(--brand-accent) 55%, transparent)"
                        : isHovered
                          ? "rgba(255,255,255,0.2)"
                          : "rgba(255,255,255,0.06)",
                      boxShadow: isReceiving
                        ? "0 0 32px -4px color-mix(in srgb, var(--brand-accent) 60%, transparent)"
                        : isHovered
                          ? "0 10px 28px -10px rgba(0,0,0,0.45)"
                          : "none",
                    }}
                    transition={{ duration: 0.28, ease: snapEase }}
                    className="relative flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 md:gap-3 md:px-3.5 md:py-3"
                  >
                    <Folder
                      className={`h-4 w-4 shrink-0 md:h-[18px] md:w-[18px] ${
                        isReceiving || isHovered
                          ? "text-[var(--brand-accent)]"
                          : "text-slate-500"
                      }`}
                      fill={isReceiving ? "var(--brand-accent)" : "none"}
                    />

                    <span
                      className={`min-w-0 flex-1 truncate text-[10px] font-medium md:text-xs ${
                        isReceiving || isHovered
                          ? "text-white"
                          : "text-slate-300"
                      }`}
                    >
                      {folder.name}
                    </span>

                    <motion.span
                      animate={{
                        scale: isTopMatch && isSelecting ? [1, 1.08, 1] : 1,
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: isTopMatch && isSelecting ? Infinity : 0,
                        ease: "easeInOut",
                      }}
                      className={`shrink-0 rounded-lg px-1.5 py-0.5 font-mono text-[9px] font-semibold md:px-2 md:text-[10px] ${
                        isTopMatch
                          ? "bg-[color-mix(in_srgb,var(--brand-accent)_25%,transparent)] text-[color-mix(in_srgb,var(--brand-accent)_55%,white)] ring-1 ring-[color-mix(in_srgb,var(--brand-accent)_40%,transparent)]"
                          : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {folder.match}%{t.mockup.matchLabel ? ` ${t.mockup.matchLabel}` : ""}
                    </motion.span>

                    {isClicked && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0.8 }}
                        animate={{ scale: 2.4, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-[color-mix(in_srgb,var(--brand-accent)_30%,transparent)]"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Fluid spring cursor */}
            <AnimatePresence>
              {showCursor && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute z-20"
                  style={{ x: cursorX, y: cursorY, top: 12, right: 8 }}
                >
                  <motion.div
                    animate={{
                      scale: phase === "click" ? [1, 0.82, 0.95] : [1, 1.02, 1],
                      rotate: phase === "cursor" ? [0, -2, 0] : 0,
                    }}
                    transition={{
                      scale: {
                        duration: phase === "click" ? 0.22 : 1.6,
                        repeat: phase === "click" ? 0 : Infinity,
                        ease: "easeInOut",
                      },
                      rotate: {
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }}
                    className="drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
                  >
                    <MousePointer2
                      className="h-6 w-6 fill-white text-slate-900 md:h-7 md:w-7"
                      strokeWidth={1.5}
                    />
                  </motion.div>

                  {phase === "click" && (
                    <>
                      <motion.span
                        initial={{ scale: 0, opacity: 0.9 }}
                        animate={{ scale: [0, 1.8, 2.4], opacity: [0.9, 0.4, 0] }}
                        transition={{ duration: 0.38, ease: "easeOut" }}
                        className="absolute -bottom-2 -left-2 h-5 w-5 rounded-full border-2 border-[var(--brand-accent)] bg-[color-mix(in_srgb,var(--brand-accent)_20%,transparent)]"
                      />
                      <motion.span
                        initial={{ scale: 0, opacity: 0.6 }}
                        animate={{ scale: [0, 2.8, 3.6], opacity: [0.6, 0.2, 0] }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: 0.03 }}
                        className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full border border-[color-mix(in_srgb,var(--brand-accent)_50%,transparent)]"
                      />
                    </>
                  )}

                  {phase === "cursor" && (
                    <motion.span
                      animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.15, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_40%,transparent)] blur-[2px]"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
