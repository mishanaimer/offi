"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles, Ticket, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsTabs } from "@/components/settings-tabs";
import { UsageBar } from "@/components/usage-bar";
import { useBranding } from "@/components/branding-provider";
import { PLANS, PAID_PLANS, getPlan, getEffectivePrice, type PlanCode } from "@/lib/plans";
import { cn, formatDate } from "@/lib/utils";

type Usage = {
  requestsCount: number;
  actionsCount: number;
  documentsCount: number;
  memoriesCount: number;
  actionsLogCount: number;
  employeesCount: number;
};

type LastRequest = {
  plan: string;
  billing_period: string;
  status: string;
  created_at: string;
} | null;

export function PlansView({
  company,
  currentUserRole,
  usage,
  lastRequest,
}: {
  company: {
    id: string;
    plan: string;
    is_founder?: boolean | null;
    locked_price?: Record<string, number> | null;
    pilot_until?: string | null;
    promo_code?: string | null;
  };
  currentUserRole: "owner" | "admin" | "member";
  usage: Usage;
  lastRequest: LastRequest;
}) {
  const router = useRouter();
  const brand = useBranding();
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const currentPlan = getPlan(company.plan);
  const [billing, setBilling] = useState<"month" | "year">("month");
  const [busyCode, setBusyCode] = useState<PlanCode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoErr, setPromoErr] = useState<string | null>(null);

  async function activatePromo() {
    if (!isAdmin || !promo.trim()) return;
    setPromoBusy(true);
    setPromoErr(null);
    setErr(null);
    try {
      const res = await fetch("/api/promo/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Ошибка активации");
      if (j.is_founder) {
        setToast("🎉 Вы участник Founders-программы! Скидка 50% зафиксирована пожизненно при непрерывной подписке.");
      } else if (j.plan === "pilot" && j.pilot_until) {
        setToast(`Пилот активирован до ${formatDate(j.pilot_until)}. Полный доступ ко всем модулям.`);
      } else {
        setToast(`Промокод активирован: тариф «${getPlan(j.plan).name}».`);
      }
      setPromo("");
      router.refresh();
    } catch (e) {
      setPromoErr((e as Error).message);
    } finally {
      setPromoBusy(false);
    }
  }

  async function request(plan: PlanCode) {
    if (!isAdmin) return;
    setBusyCode(plan);
    setErr(null);
    try {
      const res = await fetch("/api/plan-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing_period: billing }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "failed");
      }
      setToast(`Заявка на тариф «${PLANS[plan].name}» отправлена — свяжемся в течение рабочего дня.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <header className="h-16 sticky top-0 z-10 glass border-b border-border/60 px-4 md:px-6 flex items-center">
        <h1 className="text-lg font-semibold">Настройки</h1>
        {!isAdmin && (
          <span className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> только просмотр
          </span>
        )}
      </header>
      <SettingsTabs />

      <div className="container-page max-w-5xl py-6 md:py-8 space-y-6">
        {/* Usage */}
        <section className="card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Использование</h2>
              <p className="text-xs text-muted-foreground">
                Тариф «{currentPlan.name}» · обновление счётчиков в начале каждого месяца
              </p>
            </div>
            <span
              className="text-xs rounded-full px-2.5 h-6 inline-flex items-center"
              style={{
                background: `color-mix(in srgb, ${brand.accentColor} 12%, transparent)`,
                color: brand.accentColor,
              }}
            >
              {currentPlan.name}
            </span>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <UsageBar
              label="AI-запросов в месяце"
              used={usage.requestsCount}
              limit={currentPlan.limits.requests}
              accent={brand.accentColor}
            />
            <UsageBar
              label="Действий в месяце"
              used={usage.actionsCount}
              limit={currentPlan.limits.actions}
              accent={brand.accentColor}
            />
            <UsageBar
              label="Документов"
              used={usage.documentsCount}
              limit={currentPlan.limits.documents}
              accent={brand.accentColor}
            />
            <UsageBar
              label="Фактов памяти"
              used={usage.memoriesCount}
              limit={currentPlan.limits.memories}
              accent={brand.accentColor}
            />
            <UsageBar
              label="Сотрудников"
              used={usage.employeesCount}
              limit={currentPlan.limits.employees}
              accent={brand.accentColor}
            />
          </div>
        </section>

        {/* Pending request badge */}
        {lastRequest?.status === "pending" && (
          <div
            className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
            style={{
              background: `color-mix(in srgb, ${brand.accentColor} 8%, transparent)`,
              color: brand.accentColor,
            }}
          >
            <Sparkles className="w-4 h-4" />
            Заявка на тариф «{getPlan(lastRequest.plan).name}» от {formatDate(lastRequest.created_at)} в обработке.
          </div>
        )}

        {/* Toggler */}
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-full bg-muted p-1">
            <button
              onClick={() => setBilling("month")}
              className={cn(
                "px-4 h-9 rounded-full text-sm font-medium transition",
                billing === "month" ? "bg-white shadow-sm" : "text-muted-foreground"
              )}
              style={billing === "month" ? { color: brand.accentColor } : undefined}
            >
              Месяц
            </button>
            <button
              onClick={() => setBilling("year")}
              className={cn(
                "px-4 h-9 rounded-full text-sm font-medium transition inline-flex items-center gap-1.5",
                billing === "year" ? "bg-white shadow-sm" : "text-muted-foreground"
              )}
              style={billing === "year" ? { color: brand.accentColor } : undefined}
            >
              Год
              <span className="text-[10px] rounded-full px-1.5 bg-[#059669]/10 text-[#059669] font-semibold">
                −20%
              </span>
            </button>
          </div>
        </div>

        {/* Founders badge */}
        {company.is_founder && (
          <div
            className="rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-start gap-3"
          >
            <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Crown className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-amber-900">Founders-программа активна</h3>
              <p className="mt-0.5 text-[12.5px] leading-[1.55] text-amber-800/80">
                У вас зафиксирована скидка 50% пожизненно при непрерывной подписке. Цены в карточках ниже — уже с вашей скидкой.
              </p>
            </div>
          </div>
        )}

        {/* Plans grid */}
        <section className="grid md:grid-cols-3 gap-4">
          {PAID_PLANS.map((code) => {
            const p = PLANS[code];
            const isCurrent = company.plan === code;
            const stdMonth = p.priceMonth;
            const stdYear = p.priceYear;
            const effMonth = getEffectivePrice(company, code, "month");
            const effYear = getEffectivePrice(company, code, "year");
            const price = billing === "month" ? effMonth : effYear;
            const stdPrice = billing === "month" ? stdMonth : stdYear;
            const isFounderPrice = company.is_founder && price < stdPrice;
            const priceSuffix = billing === "month" ? "₽/мес" : "₽/год";
            return (
              <div
                key={code}
                className={cn(
                  "relative rounded-2xl border bg-card p-5 transition",
                  p.highlight ? "shadow-md" : ""
                )}
                style={
                  isCurrent
                    ? { borderColor: brand.accentColor, boxShadow: `0 0 0 2px ${brand.accentColor}22` }
                    : undefined
                }
              >
                {p.highlight && (
                  <span
                    className="absolute -top-2.5 right-4 rounded-full px-2.5 h-5 text-[10px] text-white inline-flex items-center"
                    style={{ background: brand.accentColor }}
                  >
                    Популярный
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold text-base">{p.name}</div>
                  {isCurrent && (
                    <span
                      className="text-[10px] font-medium rounded-full px-2 h-5 inline-flex items-center"
                      style={{
                        background: `color-mix(in srgb, ${brand.accentColor} 14%, transparent)`,
                        color: brand.accentColor,
                      }}
                    >
                      Текущий
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{p.tagline}</div>
                <div className="mt-4 text-[28px] leading-none font-semibold tabular-nums">
                  {price.toLocaleString("ru")}
                  <span className="text-sm text-muted-foreground font-normal ml-1">{priceSuffix}</span>
                </div>
                {isFounderPrice && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                    <Crown className="w-3 h-3 text-amber-600" />
                    <span className="text-amber-700 font-medium">Founders</span>
                    <span className="text-muted-foreground line-through">{stdPrice.toLocaleString("ru")} ₽</span>
                  </div>
                )}
                {!isFounderPrice && billing === "year" && (
                  <div className="mt-1 text-[11px] text-[#059669]">
                    экономия {(p.priceMonth * 12 - p.priceYear).toLocaleString("ru")} ₽
                  </div>
                )}
                <ul className="mt-5 space-y-1.5 text-sm">
                  <LimitRow label="AI-запросов/мес" value={p.limits.requests} />
                  <LimitRow label="Сотрудников" value={p.limits.employees} />
                  <LimitRow label="Документов" value={p.limits.documents} />
                  <LimitRow label="Памяти (фактов)" value={p.limits.memories} />
                  <LimitRow label="Действий/мес" value={p.limits.actions} />
                  {p.integrations.length > 0 && (
                    <li className="flex items-start gap-2 pt-1">
                      <Check className="w-4 h-4 mt-0.5" style={{ color: brand.accentColor }} />
                      <span className="text-muted-foreground">{p.integrations.join(", ")}</span>
                    </li>
                  )}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <Button disabled variant="outline" className="w-full">
                      Текущий тариф
                    </Button>
                  ) : (
                    <Button
                      disabled={!isAdmin || busyCode === code}
                      onClick={() => request(code)}
                      className="w-full"
                      style={{ background: brand.accentColor }}
                    >
                      {busyCode === code ? "Отправляем…" : "Перейти"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {toast && (
          <div
            className="rounded-xl px-4 py-3 text-sm border"
            style={{ borderColor: brand.accentColor, color: brand.accentColor }}
          >
            {toast}
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}

        {/* Промокод — пилотный доступ */}
        <section className="card-surface p-5">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl"
              style={{ background: `color-mix(in srgb, ${brand.accentColor} 12%, transparent)`, color: brand.accentColor }}
            >
              <Ticket className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Есть промокод?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Введите код, чтобы активировать пилотный или акционный доступ.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value.toUpperCase())}
                  disabled={!isAdmin || promoBusy}
                  placeholder="PILOT2026"
                  className="flex-1 h-10 rounded-lg border border-border bg-background px-3.5 text-sm tracking-wider font-mono uppercase placeholder:text-[hsl(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                  maxLength={32}
                />
                <Button
                  disabled={!isAdmin || promoBusy || !promo.trim()}
                  onClick={activatePromo}
                  style={{ background: brand.accentColor }}
                  className="sm:w-auto"
                >
                  {promoBusy ? "Активируем…" : "Активировать"}
                </Button>
              </div>
              {promoErr && <p className="mt-2 text-xs text-destructive">{promoErr}</p>}
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Биллинг проводится вручную на этапе пилота: отправьте заявку, мы свяжемся и переведём.
        </p>
      </div>
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: number }) {
  const formatted = value >= 999999 ? "без ограничений" : value.toLocaleString("ru");
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 mt-0.5 text-muted-foreground" />
      <span>
        <span className="font-medium tabular-nums">{formatted}</span>{" "}
        <span className="text-muted-foreground">{label.toLowerCase()}</span>
      </span>
    </li>
  );
}
