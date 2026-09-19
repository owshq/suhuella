"use client";

import { motion } from "framer-motion";
import { Folder } from "lucide-react";

type FloatingFolder = {
  className: string;
  iconClass: string;
  fill: string;
  opacity?: string;
  hideOnLanding?: boolean;
  animate: { y: number[]; rotate: number[]; x?: number[] };
  duration: number;
};

const floatingFolders: FloatingFolder[] = [
  {
    className: "bottom-[8%] left-[4%] h-14 w-14 -rotate-6",
    iconClass: "h-7 w-7 text-violet-500",
    fill: "#8B5CF6",
    animate: { y: [0, -22, 0], rotate: [-6, 8, -6] },
    duration: 7,
  },
  {
    className: "top-[12%] left-[22%] h-10 w-10 rotate-12",
    iconClass: "h-5 w-5 text-rose-500",
    fill: "#F43F5E",
    hideOnLanding: true,
    animate: { y: [0, 18, 0], rotate: [12, -4, 12] },
    duration: 5.5,
  },
  {
    className: "right-[4%] bottom-[28%] h-16 w-16 -rotate-12",
    iconClass: "h-8 w-8 text-emerald-500",
    fill: "#10B981",
    animate: { y: [0, -28, 0], rotate: [-12, 6, -12] },
    duration: 8,
  },
  {
    className: "right-[20%] top-[18%] h-11 w-11 rotate-6",
    iconClass: "h-5 w-5 text-amber-500",
    fill: "#F59E0B",
    animate: { y: [0, 20, 0], rotate: [6, -10, 6] },
    duration: 6,
  },
  {
    className: "bottom-[38%] left-[14%] h-9 w-9 -rotate-3",
    iconClass: "h-4 w-4 text-sky-500",
    fill: "#0EA5E9",
    opacity: "opacity-90",
    hideOnLanding: true,
    animate: { y: [0, -14, 0], rotate: [-3, 6, -3] },
    duration: 5,
  },
  {
    className: "top-[8%] right-[8%] h-12 w-12 rotate-[-8deg]",
    iconClass: "h-6 w-6 text-indigo-500",
    fill: "#6366F1",
    animate: { y: [0, 16, 0], x: [0, -6, 0], rotate: [-8, 4, -8] },
    duration: 6.5,
  },
  {
    className: "bottom-[18%] right-[32%] h-8 w-8 rotate-10",
    iconClass: "h-4 w-4 text-fuchsia-500",
    fill: "#D946EF",
    opacity: "opacity-85",
    animate: { y: [0, 12, 0], rotate: [10, -6, 10] },
    duration: 4.8,
  },
  {
    className: "top-[42%] left-[6%] h-11 w-11 -rotate-12",
    iconClass: "h-5 w-5 text-teal-500",
    fill: "#14B8A6",
    hideOnLanding: true,
    animate: { y: [0, -16, 0], rotate: [-12, 5, -12] },
    duration: 7.2,
  },
  {
    className: "top-[28%] right-[38%] h-9 w-9 rotate-3",
    iconClass: "h-4 w-4 text-orange-500",
    fill: "#F97316",
    opacity: "opacity-80",
    animate: { y: [0, 14, 0], rotate: [3, -5, 3] },
    duration: 5.2,
  },
  {
    className: "bottom-[6%] right-[12%] h-10 w-10 -rotate-6",
    iconClass: "h-5 w-5 text-blue-500",
    fill: "#3B82F6",
    animate: { y: [0, -18, 0], rotate: [-6, 8, -6] },
    duration: 6.8,
  },
  {
    className: "top-[55%] left-[28%] h-8 w-8 rotate-[-14deg]",
    iconClass: "h-4 w-4 text-violet-400",
    fill: "#A78BFA",
    opacity: "opacity-75",
    hideOnLanding: true,
    animate: { y: [0, 10, 0], rotate: [-14, 4, -14] },
    duration: 4.5,
  },
  {
    className: "bottom-[48%] right-[6%] h-[52px] w-[52px] rotate-8",
    iconClass: "h-6 w-6 text-rose-400",
    fill: "#FB7185",
    animate: { y: [0, -20, 0], rotate: [8, -6, 8] },
    duration: 7.5,
  },
];

type AnimatedMeshBackgroundProps = {
  landing?: boolean;
  contained?: boolean;
};

export function AnimatedMeshBackground({
  landing = false,
  contained = false,
}: AnimatedMeshBackgroundProps) {
  const visibleFolders = landing
    ? floatingFolders.filter((folder) => !folder.hideOnLanding)
    : floatingFolders;

  return (
    <div
      aria-hidden
      className={
        contained
          ? "pointer-events-none absolute inset-0 overflow-hidden bg-[var(--brand-surface,#A7D8F9)]"
          : "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--brand-surface,#A7D8F9)]"
      }
    >
      <motion.div
        className="absolute left-[10%] top-[20%] h-4 w-4 rounded-full bg-[#3B82F6]/80"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[15%] top-[40%] h-3 w-3 rounded-full bg-[#3B82F6]/60"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[20%] left-[25%] h-6 w-6 rounded-full bg-white/60"
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[25%] top-[15%] h-8 w-8 rounded-full bg-white/40"
        animate={{ y: [0, 25, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {visibleFolders.map((item, index) => (
            <motion.div
              key={index}
              className={`absolute flex items-center justify-center rounded-2xl border border-white/50 bg-white/45 shadow-lg backdrop-blur-md ${item.opacity ?? "opacity-95"} ${item.className}`}
              animate={item.animate}
              transition={{
                duration: item.duration,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Folder
                className={item.iconClass}
                fill={item.fill}
                strokeWidth={1.5}
              />
            </motion.div>
          ))}
    </div>
  );
}
