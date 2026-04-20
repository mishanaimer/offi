import { cn } from "@/lib/utils";

export function Logo({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect width="32" height="32" rx="9" fill="hsl(var(--accent-brand))" />
        <path
          d="M11.2 10.4C9 10.4 7.4 12 7.4 14.3v3.4C7.4 20 9 21.6 11.2 21.6h3.4c2.3 0 3.9-1.6 3.9-3.9v-3.4c0-2.3-1.6-3.9-3.9-3.9h-3.4ZM21 10.4v11.2h3.6V10.4H21Z"
          fill="white"
        />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Offi</span>
    </div>
  );
}
