"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Скачать PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--border))] bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--accent-brand-light))] hover:text-primary hover:border-[hsl(var(--accent-brand-mid))]"
      aria-label={label}
    >
      <Printer size={16} aria-hidden />
      {label}
    </button>
  );
}
