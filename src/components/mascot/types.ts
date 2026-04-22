export const HEAD_SHAPES = ["classic", "soft", "wide", "tall", "capsule"] as const;
export const ANTENNA_STYLES = ["ball", "pill", "bent", "bolt", "dot", "ring", "none"] as const;
export const EAR_STYLES = ["round", "rect", "small", "none"] as const;

export type HeadShape = (typeof HEAD_SHAPES)[number];
export type AntennaStyle = (typeof ANTENNA_STYLES)[number];
export type EarStyle = (typeof EAR_STYLES)[number];

export type MascotEmotion =
  | "idle"
  | "working"
  | "joy"
  | "sadness"
  | "pensive"
  | "surprise"
  | "angry"
  | "sleepy"
  | "love"
  | "wink";

export type MascotOneshot = Exclude<MascotEmotion, "idle" | "working">;

export type MascotConfig = {
  headShape: HeadShape;
  antenna: AntennaStyle;
  ears: EarStyle;
  color: string;
  bg: string;
};

export const HEAD_SHAPE_LABELS: Record<HeadShape, string> = {
  classic: "Классика",
  soft: "Мягкий",
  wide: "Широкий",
  tall: "Высокий",
  capsule: "Капсула",
};

export const ANTENNA_LABELS: Record<AntennaStyle, string> = {
  ball: "Шарик",
  pill: "Пилюля",
  bent: "Угол",
  bolt: "Молния",
  dot: "Точка",
  ring: "Кольцо",
  none: "Нет",
};

export const EAR_LABELS: Record<EarStyle, string> = {
  round: "Круглые",
  rect: "Квадрат",
  small: "Точки",
  none: "Нет",
};

export const ONESHOT_META: Record<MascotOneshot, { label: string; icon: string; durMs: number }> = {
  joy: { label: "Радость", icon: "🎉", durMs: 2800 },
  sadness: { label: "Грусть", icon: "😔", durMs: 2800 },
  pensive: { label: "Задумчивость", icon: "🤔", durMs: 3000 },
  surprise: { label: "Удивление", icon: "😲", durMs: 2200 },
  angry: { label: "Злость", icon: "😠", durMs: 2500 },
  sleepy: { label: "Сонный", icon: "😴", durMs: 3200 },
  love: { label: "Любовь", icon: "😍", durMs: 2800 },
  wink: { label: "Подмигивание", icon: "😉", durMs: 2000 },
};
