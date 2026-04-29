"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProgressStage = {
  id: string;
  label: string;
  /** ожидаемая доля времени этапа от 0 до 1 (сумма по stages должна быть = 1) */
  weight: number;
};

type Props = {
  stages: ProgressStage[];
  /** id текущего этапа. null = ещё не начали; "done" = всё закончено */
  currentStageId: string | null | "done";
  /** ошибка — окрашиваем бар в красный, останавливаем */
  error?: string | null;
  className?: string;
  /** заголовок над баром */
  title?: string;
};

/**
 * Псевдо-прогрессбар: пока сервер не стримит, мы внутри текущего этапа
 * плавно наращиваем прогресс по экспоненте к концу этапа, не доходя до
 * него. Когда апп переключает stage — прыгаем на границу между этапами.
 *
 * Это даёт пользователю осмысленную обратную связь («Анализирую… 60%»)
 * без обмана: бар никогда не достигает 100% до фактического конца.
 */
export function ProgressBar({ stages, currentStageId, error, className, title }: Props) {
  const [pct, setPct] = useState(0);
  const animRef = useRef<number | null>(null);
  const stageStartRef = useRef<number>(0);
  const startPctRef = useRef<number>(0);

  // Границы этапов (cumulative %)
  const bounds = (() => {
    const out: { id: string; from: number; to: number; label: string }[] = [];
    let acc = 0;
    for (const s of stages) {
      const next = Math.min(1, acc + s.weight);
      out.push({ id: s.id, from: acc, to: next, label: s.label });
      acc = next;
    }
    return out;
  })();

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    if (currentStageId === null) {
      setPct(0);
      return;
    }
    if (currentStageId === "done") {
      setPct(100);
      return;
    }

    const stage = bounds.find((b) => b.id === currentStageId);
    if (!stage) return;

    // Задаём «потолок» внутри этапа — 90% от его диапазона.
    const ceilingPct = (stage.from + (stage.to - stage.from) * 0.9) * 100;
    const startPct = Math.max(stage.from * 100, pct);
    stageStartRef.current = performance.now();
    startPctRef.current = startPct;

    // Тиковая функция: за 8 секунд экспоненциально дойти до потолка.
    const tick = () => {
      const elapsed = (performance.now() - stageStartRef.current) / 1000; // секунды
      const k = 1 - Math.exp(-elapsed / 3); // 0 → 1 за ~10s
      const value = startPctRef.current + (ceilingPct - startPctRef.current) * k;
      setPct(value);
      if (k < 0.99) {
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStageId]);

  const currentLabel =
    currentStageId === "done"
      ? "Готово"
      : bounds.find((b) => b.id === currentStageId)?.label ?? title ?? "";

  return (
    <div className={cn("space-y-2", className)} aria-live="polite" role="status">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={cn("font-medium", error ? "text-destructive" : "text-foreground")}>
          {error ? `Ошибка: ${error}` : currentLabel || title}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-300 ease-out",
            error ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Метки этапов */}
        <div className="pointer-events-none absolute inset-0">
          {bounds.slice(0, -1).map((b) => (
            <div
              key={b.id}
              className="absolute top-0 h-full w-px bg-background/60"
              style={{ left: `${b.to * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
