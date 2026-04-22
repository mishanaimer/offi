/**
 * Тарифная конфигурация — центральный источник истины.
 * Цены в рублях. Лимиты — на компанию, на календарный месяц (кроме sim-лимитов).
 */

export type PlanCode = "trial" | "start" | "business" | "team";

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
  priceMonth: number;    // ₽ в месяц
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
    limits: { requests: 50, documents: 10, memories: 20, employees: 1, actions: 5 },
    integrations: [],
  },
  start: {
    code: "start",
    name: "Старт",
    tagline: "Для небольших команд",
    priceMonth: 2490,
    priceYear: 23900,
    limits: { requests: 500, documents: 50, memories: 200, employees: 3, actions: 50 },
    integrations: ["email", "telegram"],
  },
  business: {
    code: "business",
    name: "Бизнес",
    tagline: "Для растущих компаний",
    priceMonth: 5990,
    priceYear: 57500,
    limits: { requests: 3000, documents: 300, memories: 2000, employees: 10, actions: 500 },
    integrations: ["email", "telegram", "amocrm", "bitrix24"],
    highlight: true,
  },
  team: {
    code: "team",
    name: "Команда",
    tagline: "Корпоративные сценарии",
    priceMonth: 11990,
    priceYear: 115100,
    limits: { requests: 15000, documents: 999999, memories: 999999, employees: 30, actions: 3000 },
    integrations: ["email", "telegram", "amocrm", "bitrix24", "1c", "google_drive"],
  },
};

export const PAID_PLANS: PlanCode[] = ["start", "business", "team"];

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
