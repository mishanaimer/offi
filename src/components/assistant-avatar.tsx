"use client";

import { Sparkles, Bot, Zap, Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  sparkles: Sparkles,
  bot: Bot,
  zap: Zap,
  star: Star,
  flame: Flame,
} as const;

export type AssistantIcon = keyof typeof ICONS;

export function AssistantAvatar({
  icon = "sparkles",
  color,
  size = 28,
  className,
}: {
  icon?: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const I = (ICONS as any)[icon] ?? ICONS.sparkles;
  const inner = Math.round(size * 0.5);
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full text-white shrink-0", className)}
      style={{ width: size, height: size, background: color }}
      aria-hidden
    >
      <I style={{ width: inner, height: inner }} />
    </span>
  );
}
