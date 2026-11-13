import React from "react";
import { cn } from "../utils/cn";

const badgeStyles: Record<string, { bg: string; text: string; border: string; dot?: string }> = {
  CRITICAL: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/60",
    dot: "bg-rose-500"
  },
  HIGH: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800/60",
    dot: "bg-orange-500"
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
    dot: "bg-amber-500"
  },
  LOW: {
    bg: "bg-slate-50 dark:bg-slate-800/60",
    text: "text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400"
  },
  ESCALATED: {
    bg: "bg-red-500/10 dark:bg-red-950/50",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-800/60",
    dot: "bg-red-600"
  },
  IN_PROGRESS: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/60",
    dot: "bg-blue-500"
  },
  ASSIGNED: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800/60",
    dot: "bg-indigo-500"
  },
  OPEN: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800/60",
    dot: "bg-teal-500"
  },
  USER_CONFIRMATION: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800/60",
    dot: "bg-purple-500"
  },
  RESOLVED: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
    dot: "bg-emerald-500"
  },
  CLOSED: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-500"
  },
  REOPENED: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
    dot: "bg-amber-500"
  },
  Available: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
    dot: "bg-emerald-500"
  },
  Busy: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
    dot: "bg-amber-500"
  },
  Offline: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-500 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400"
  }
};

export function StatusBadge({ value }: { value: string }) {
  const normalized = value || "OPEN";
  const style = badgeStyles[normalized] ?? {
    bg: "bg-slate-50 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shadow-2xs select-none",
        style.bg,
        style.text,
        style.border
      )}
    >
      {style.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />}
      <span>{normalized.replace(/_/g, " ")}</span>
    </span>
  );
}
