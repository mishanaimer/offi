import {
  HEAD_SHAPES,
  ANTENNA_STYLES,
  EAR_STYLES,
  type HeadShape,
  type AntennaStyle,
  type EarStyle,
  type MascotConfig,
} from "@/components/mascot/types";

// Детерминированный генератор: одна и та же компания всегда получает
// один и тот же маскот. Разные компании — разные комбинации.
// Используется в онбординге (авто-подбор под бренд) и как fallback,
// если admin не кастомизировал маскота вручную.

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

export function generateMascotConfig(input: {
  companyName: string;
  accentColor: string;
  bgHint?: string | null;
}): MascotConfig {
  const name = (input.companyName || "offi").trim().toLowerCase();
  const h1 = hashString(name);
  const h2 = hashString(name + "~antenna");
  const h3 = hashString(name + "~ears");

  // Чуть смещаем вероятности, чтобы в выборке чаще попадались «дружелюбные» формы.
  const headPool: HeadShape[] = ["classic", "soft", "soft", "capsule", "wide", "tall"];
  const antennaPool: AntennaStyle[] = ["ball", "ball", "pill", "dot", "ring", "bent", "bolt"];
  const earPool: EarStyle[] = ["round", "round", "rect", "small", "none"];

  return {
    headShape: pick(headPool, h1),
    antenna: pick(antennaPool, h2),
    ears: pick(earPool, h3),
    color: input.accentColor || "#1a6eff",
    bg: input.bgHint || tintFromHex(input.accentColor || "#1a6eff"),
  };
}

// Очень светлая подложка из hex-цвета (5–6% насыщенности),
// чтобы сочеталась с любым брендовым цветом.
export function tintFromHex(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "#EEF4FF";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const mix = (c: number) => Math.round(c * 0.06 + 255 * 0.94);
  const to = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export const MASCOT_VALID = {
  headShape: new Set<string>(HEAD_SHAPES),
  antenna: new Set<string>(ANTENNA_STYLES),
  ears: new Set<string>(EAR_STYLES),
};
