import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ВАЖНО: дата форматируется и на сервере (SSR), и на клиенте. Без фиксированной
// таймзоны два рендера дают разные строки → React выкидывает hydration error
// (#418/#423/#425). Фиксируем Europe/Moscow — это целевая таймзона продукта.
export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

export function formatRub(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

export function truncate(s: string, n = 140) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
