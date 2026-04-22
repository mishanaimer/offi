"use client";

import { cn } from "@/lib/utils";
import { bucket } from "@/lib/plans";

export function UsageBar({
  label,
  used,
  limit,
  accent,
  hint,
  className,
}: {
  label: string;
  used: number;
  limit: number;
  accent: string;
  hint?: string;
  className?: string;
}) {
  const b = bucket(used, limit);
  const barColor = b.block ? "#E11D48" : b.warn ? "#F59E0B" : accent;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {used.toLocaleString("ru")}
          <span className="text-muted-foreground"> / {limit.toLocaleString("ru")}</span>
          {b.warn && (
            <span className="ml-1.5 text-[11px] text-[#B45309]">⚠ {b.percent}%</span>
          )}
          {b.block && (
            <span className="ml-1.5 text-[11px] text-destructive">исчерпан</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.min(100, b.percent)}%`, background: barColor }}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
