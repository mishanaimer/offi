/**
 * Тарифная конфигурация — центральный источник истины.
 * Цены в рублях. Лимиты — на компанию, на календарный месяц (кроме sim-лимитов).
 *
 * Founders Pricing: первые 50 платящих компаний получают locked_price.
 * Цены проверяются через getEffectivePrice(company, plan) — НЕ трогать PLANS напрямую при биллинге.
 */

export type PlanCode = "trial" | "pilot" | "start" | "business" | "team";

export type PlanLimits = {
  requests: number;      // AI-запросов в месяц
  documents: number;     // документов в базе знаний
  memories: number;      // фактов памяти
  employees: number;     // сотрудников в компании
  actions: number;       // реальных экшенов (email/telegram/calendar)
};

export type PlanDef = {
  code: PlanCode;
  name: string;
  tagline: string;
  priceMonth: number;    // ₽ в месяц (стандартный прайс)
  priceYear: number;     // ₽ за год (со скидкой ~20%)
  limits: PlanLimits;
  integrations: string[];
  highlight?: boolean;   // выделить карточку
};

export const PLANS: Record<PlanCode, PlanDef> = {
  trial: {
    code: "trial",
    name: "Пробный",
    tagline: "14 дней, чтобы попробовать",
    priceMonth: 0,
    priceYear: 0,
    limits: { requests: 30, documents: 5, memories: 20, employees: 1, actions: 5 },
    integrations: [],
  },
  pilot: {
    code: "pilot",
    name: "Пилот",
    tagline: "Бесплатный месяц для пилотных компаний",
    priceMonth: 0,
    priceYear: 0,
    limits: { requests: 800, documents: 50, memories: 500, employees: 3, actions: 100 },
    integrations: ["email", "telegram"],
  },
  start: {
    code: "start",
    name: "Старт",
    tagline: "Для микро-команд до 3 человек",
    priceMonth: 3490,
    priceYear: 33500,
    limits: { requests: 800, documents: 50, memories: 500, employees: 3, actions: 80 },
    integrations: ["email", "telegram"],
  },
  business: {
    code: "business",
    name: "Бизнес",
    tagline: "Для растущих команд до 10 человек",
    priceMonth: 9990,
    priceYear: 95900,
    limits: { requests: 2500, documents: 200, memories: 2000, employees: 10, actions: 400 },
    integrations: ["email", "telegram", "amocrm", "bitrix24"],
    highlight: true,
  },
  team: {
    code: "team",
    name: "Команда",
    tagline: "Для команд до 30 человек",
    priceMonth: 19990,
    priceYear: 191900,
    limits: { requests: 6500, documents: 400, memories: 999999, employees: 30, actions: 2000 },
    integrations: ["email", "telegram", "amocrm", "bitrix24", "1c", "google_drive"],
  },
};

export const PAID_PLANS: PlanCode[] = ["start", "business", "team"];
export const PUBLIC_PLANS: PlanCode[] = ["trial", "start", "business", "team"]; // на странице тарифов pilot не показываем

// ────────────────────────────────────────────────────────────────────────────
// FOUNDERS PRICING
// ────────────────────────────────────────────────────────────────────────────

export const FOUNDERS_LIMIT = 50;

/** Ценник для Founders (фиксируется в companies.locked_price при активации FOUNDER) */
export const FOUNDERS_PRICE: Record<"start" | "business" | "team", number> = {
  start: 1990,
  business: 4990,
  team: 9990,
};

/** Допродажа сверх лимита (одинаково для всех) */
export const ADDON_PRICE = {
  per_100_requests: 390,
  per_document_upload: 29,
  per_extra_employee: 490,
} as const;

export type CompanyLike = {
  is_founder?: boolean | null;
  locked_price?: Record<string, number> | null;
};

/** Возвращает фактическую цену для компании на данном тарифе и периоде. */
export function getEffectivePrice(
  company: CompanyLike | null | undefined,
  plan: PlanCode,
  period: "month" | "year" = "month"
): number {
  const def = PLANS[plan];
  if (!def) return 0;

  const standard = period === "month" ? def.priceMonth : def.priceYear;

  if (!company?.is_founder || !company.locked_price) return standard;
  if (plan === "trial" || plan === "pilot") return 0;

  const lockedMonth = company.locked_price[plan];
  if (typeof lockedMonth !== "number") return standard;

  return period === "month"
    ? lockedMonth
    : Math.round(lockedMonth * 12 * 0.8); // годовой Founders -20%
}

/** Скидка в % относительно стандартной цены */
export function getFoundersDiscount(plan: PlanCode): number {
  const std = PLANS[plan]?.priceMonth ?? 0;
  const founder = FOUNDERS_PRICE[plan as "start" | "business" | "team"];
  if (!std || !founder) return 0;
  return Math.round((1 - founder / std) * 100);
}

export function getPlan(code?: string | null): PlanDef {
  const key = (code ?? "trial") as PlanCode;
  return PLANS[key] ?? PLANS.trial;
}

export function currentPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type UsageBucket = {
  used: number;
  limit: number;
  percent: number;
  warn: boolean;   // >= 80%
  block: boolean;  // >= 100%
};

export function bucket(used: number, limit: number): UsageBucket {
  const percent = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return {
    used,
    limit,
    percent,
    warn: percent >= 80 && percent < 100,
    block: percent >= 100,
  };
}
