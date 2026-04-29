"use client";

// MascotLoader — маскот в кружке с анимированным кольцом-прогрессом.
// Используется на экранах «Входим…», «Создаём аккаунт…», «Готовим рабочее место».
// Сам маскот в состоянии working (смотрит по сторонам, иногда прищур).
// Кольцо — SVG conic-stroke, вращается независимо от маскота.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { GuestMascot } from "./guest-mascot";
import type { MascotOneshot } from "./types";

export type MascotLoaderProps = {
  /** Диаметр всего виджета (px). */
  size?: number;
  /** Подпись снизу — меняется по фазам. */
  label?: string;
  /** One-shot эмоция (напр. «joy» при успехе, «surprise» при приветствии). */
  oneshotId?: MascotOneshot | null;
  oneshotKey?: number;
  /** «idle» — маскот просто дышит; «working» — активный прищур и взгляд. */
  state?: "idle" | "working";
  color?: string;
  bg?: string;
  /** Глаза следят за курсором. */
  trackCursor?: boolean;
  className?: string;
};

export function MascotLoader({
  size = 120,
  label,
  oneshotId,
  oneshotKey,
  state = "working",
  color = "#0259DD",
  bg = "#EBF2FF",
  trackCursor = true,
  className,
}: MascotLoaderProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const stroke = Math.max(2, size * 0.028);
  const mascotSize = Math.round(size * 0.78);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Рисуем «бегущий» дуговый сегмент: strokeDasharray = [arc, gap], анимируем dashoffset.
  // Делаем цикл через CSS — достаточно одной keyframes, без RAF.
  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.strokeDasharray = `${c * 0.28} ${c * 0.72}`;
  }, [c]);

  return (
    <div className={cn("inline-flex flex-col items-center gap-3", className)} aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="absolute inset-0 -rotate-90"
          style={{ overflow: "visible" }}
          aria-hidden
        >
          {/* Фоновое кольцо */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={bg}
            strokeWidth={stroke}
          />
          {/* Активная дуга — крутится вокруг центра. transformOrigin в px,
              т.к. transform-box: fill-box даёт неконсистентный результат
              в Safari/iOS на SVGCircleElement. */}
          <circle
            ref={circleRef}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              transformOrigin: `${size / 2}px ${size / 2}px`,
              animation: "mascot-loader-spin 1.8s cubic-bezier(0.6,0,0.4,1) infinite",
            }}
          />
        </svg>
        {/* Маскот — чуть уменьшен, чтобы не пересекать кольцо */}
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ animation: "mascot-loader-float 3.2s ease-in-out infinite" }}
        >
          <GuestMascot
            size={mascotSize}
            state={state}
            oneshotId={oneshotId}
            oneshotKey={oneshotKey}
            color={color}
            bg={bg}
            animated
            trackCursor={trackCursor}
          />
        </div>
      </div>
      {label && (
        <div
          className="text-sm font-medium text-muted-foreground"
          style={{ animation: "mascot-loader-pulse 2.4s ease-in-out infinite" }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
