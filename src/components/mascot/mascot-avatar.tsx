"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/components/branding-provider";
import { RobotMascot } from "./robot-mascot";
import type { MascotConfig, MascotEmotion, MascotOneshot } from "./types";

// Глобальная шина: любой код в приложении может выстрелить эмоцию,
// и все смонтированные MascotAvatar проиграют её.
type Listener = (id: MascotOneshot) => void;
let oneshotListeners: Listener[] = [];

export function fireMascotOneshot(id: MascotOneshot) {
  for (const l of oneshotListeners) l(id);
}

export type MascotAvatarProps = {
  /** Поведение маскота: спокоен или «работает» (печатает ответ). */
  state?: "idle" | "working";
  /** Override branding (для превью в настройках). */
  override?: Partial<MascotConfig>;
  size?: number;
  /**
   * Включить анимационный цикл. По умолчанию выключен — маскот показывает
   * статичный кадр (работающий «прищур», idle — «открытые глаза»).
   * Включай только для «активного» маскота на экране: стримящийся AI-bubble,
   * хедер во время sending, hero empty-state. Остальные мы не хотим анимировать
   * одновременно — это перегружает UI и бьёт по производительности.
   * One-shot эмоции проигрываются всегда, независимо от этого флага.
   */
  animated?: boolean;
  /** Слушать глобальные one-shot событие. Выключи для превью. */
  listenOneshots?: boolean;
  /** Глаза следят за курсором. Включай для центрального маскота (hero пустого чата). */
  trackCursor?: boolean;
  trackRadius?: number;
  className?: string;
};

export function MascotAvatar({
  state = "idle",
  override,
  size = 28,
  animated = false,
  listenOneshots = true,
  trackCursor = false,
  trackRadius,
  className,
}: MascotAvatarProps) {
  const brand = useBranding();
  const [oneshot, setOneshot] = useState<{ id: MascotOneshot; key: number } | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!listenOneshots) return;
    const l: Listener = (id) => {
      keyRef.current += 1;
      setOneshot({ id, key: keyRef.current });
    };
    oneshotListeners.push(l);
    return () => {
      oneshotListeners = oneshotListeners.filter((x) => x !== l);
    };
  }, [listenOneshots]);

  const config: MascotConfig = {
    color: override?.color ?? brand.assistantColor,
    bg: override?.bg ?? brand.mascot.bg,
    headShape: override?.headShape ?? brand.mascot.headShape,
    antenna: override?.antenna ?? brand.mascot.antenna,
    ears: override?.ears ?? brand.mascot.ears,
  };

  const emotion: MascotEmotion = state;

  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <RobotMascot
        color={config.color}
        bg={config.bg}
        headShape={config.headShape}
        antenna={config.antenna}
        ears={config.ears}
        emotion={emotion}
        oneshotKey={oneshot?.key}
        oneshotId={oneshot?.id ?? null}
        size={size}
        animated={animated}
        trackCursor={trackCursor}
        trackRadius={trackRadius}
      />
    </span>
  );
}
