import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  tone?: "good" | "warn" | "neutral";
}) {
  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
        </div>
        <span className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-teal-700 dark:text-teal-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p
        className={cn(
          "mt-4 text-xs font-medium",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
          tone === "neutral" && "text-slate-500 dark:text-slate-400"
        )}
      >
        {delta}
      </p>
    </article>
  );
}
