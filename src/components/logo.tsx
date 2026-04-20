import { cn } from "@/lib/utils";

/**
 * Offi wordmark — "offi.ai" с акцентом на ".ai".
 * Вариант `mark` — круглая иконка с буквой O (для аватарок, favicon'а, онбординга).
 */
export function Logo({ className, size = 19, showMark = false }: { className?: string; size?: number; showMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-[-0.04em]", className)} style={{ fontSize: size }}>
      {showMark && <OffiMark size={Math.round(size * 1.4)} />}
      <span>
        offi<span className="text-primary">.ai</span>
      </span>
    </span>
  );
}

export function OffiMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary text-white font-extrabold transition-transform duration-300 ease-out hover:scale-105",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      O
    </span>
  );
}
