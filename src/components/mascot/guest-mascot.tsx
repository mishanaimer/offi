"use client";

// GuestMascot — RobotMascot без BrandingProvider. Используется на лендинге,
// логине, регистрации, онбординге: пока у пользователя нет компании,
// нет и кастомного бренда → показываем дефолтного Оффи в цвете платформы.
//
// Плюс: собственная шина one-shot эмоций (контекстная), отдельно от глобальной
// fireMascotOneshot() в MascotAvatar. Так, например, «joy» в хедере лендинга
// не триггерит эмоцию у маскота в форме регистрации и наоборот.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { RobotMascot } from "./robot-mascot";
import type { MascotEmotion, MascotOneshot } from "./types";

export type GuestMascotProps = {
  size?: number;
  state?: "idle" | "working";
  /** One-shot эмоция — меняйте `oneshotKey`, чтобы перезапустить одну и ту же. */
  oneshotId?: MascotOneshot | null;
  oneshotKey?: number;
  color?: string;
  bg?: string;
  animated?: boolean;
  className?: string;
};

const DEFAULT_COLOR = "#0259DD";
const DEFAULT_BG = "#EBF2FF";

export function GuestMascot({
  size = 120,
  state = "idle",
  oneshotId,
  oneshotKey,
  color = DEFAULT_COLOR,
  bg = DEFAULT_BG,
  animated = true,
  className,
}: GuestMascotProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <RobotMascot
        color={color}
        bg={bg}
        headShape="classic"
        antenna="ball"
        ears="round"
        emotion={state as MascotEmotion}
        oneshotId={oneshotId ?? null}
        oneshotKey={oneshotKey}
        size={size}
        animated={animated}
      />
    </span>
  );
}

// =============================================
// Хук для удобной работы с one-shot эмоциями в одном экземпляре маскота.
// Пример: const m = useMascotEmotions(); m.fire("joy"); <GuestMascot {...m.props} />
// =============================================
export function useMascotEmotions(initialState: "idle" | "working" = "idle") {
  const [state, setState] = useState<"idle" | "working">(initialState);
  const [emo, setEmo] = useState<{ id: MascotOneshot; key: number } | null>(null);
  const keyRef = useRef(0);

  const fire = (id: MascotOneshot) => {
    keyRef.current += 1;
    setEmo({ id, key: keyRef.current });
  };

  // Авто-сброс emotionId через ~макс длительность, чтобы не зависло
  useEffect(() => {
    if (!emo) return;
    const id = window.setTimeout(() => setEmo(null), 3200);
    return () => window.clearTimeout(id);
  }, [emo]);

  return {
    state,
    setState,
    fire,
    emo,
    props: {
      state,
      oneshotId: emo?.id ?? null,
      oneshotKey: emo?.key,
    } as Pick<GuestMascotProps, "state" | "oneshotId" | "oneshotKey">,
  };
}
