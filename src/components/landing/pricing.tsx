import Link from "next/link";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "start",
    name: "Старт",
    price: "0",
    period: "навсегда",
    emoji: "🌱",
    desc: "Для знакомства с Offi",
    features: ["1 пользователь", "50 запросов/день", "5 документов", "Базовые интеграции"],
    cta: "Начать бесплатно",
    href: "/register",
  },
  {
    id: "pro",
    name: "Pro",
    price: "2 990",
    period: "₽/мес",
    emoji: "⚡",
    popular: true,
    desc: "Для растущего бизнеса",
    features: ["До 10 пользователей", "Безлимитные запросы", "Безлимитные документы", "Все интеграции", "Приоритетная поддержка", "API доступ"],
    cta: "Попробовать 14 дней",
    href: "/register",
  },
  {
    id: "team",
    name: "Команда",
    price: "7 990",
    period: "₽/мес",
    emoji: "🏢",
    desc: "Для компаний от 10 человек",
    features: ["До 50 пользователей", "Всё из Pro", "Выделенный сервер", "SLA 99.9%", "Персональный менеджер", "Кастомные интеграции"],
    cta: "Связаться",
    href: "mailto:hello@offi.ai",
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="max-w-[920px] mx-auto pt-[88px]">
      <Reveal>
        <div className="text-center mb-12 px-6 md:px-8">
          <p className="text-[13px] font-semibold text-primary mb-2">Тарифы</p>
          <h2 className="text-[30px] md:text-[32px] font-extrabold text-foreground tracking-[-0.035em]">
            Простые и честные цены
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Начните бесплатно, масштабируйтесь когда готовы
          </p>
        </div>
      </Reveal>

      {/* На мобилках — горизонтальный snap-скролл, на десктопе — 3 колонки.
          На мобиле карточки ~82% ширины viewport'а: видно край следующей →
          сразу понятно, что можно листать. */}
      <div
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-4 px-6 md:px-8 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0 items-stretch"
        style={{ scrollPadding: "0 24px" }}
      >
        {PLANS.map((p, i) => (
          <Reveal
            key={p.id}
            delay={i * 100}
            className="shrink-0 w-[82%] sm:w-[62%] md:w-auto snap-start"
          >
            <PlanCard plan={p} />
          </Reveal>
        ))}
      </div>

      {/* Индикатор скролла на мобиле */}
      <div className="flex md:hidden justify-center gap-1.5 mt-2">
        {PLANS.map((p) => (
          <span
            key={p.id}
            className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--border))]"
            aria-hidden
          />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ plan: p }: { plan: (typeof PLANS)[number] }) {
  return (
    <div
      className={cn(
        "relative rounded-[18px] p-6 md:p-7 border card-hover h-full flex flex-col",
        p.popular ? "bg-primary border-primary" : "bg-card border-border hover:border-[hsl(var(--accent-brand-mid))]"
      )}
    >
      {p.popular && (
        <div
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-white text-primary text-[11px] font-bold whitespace-nowrap"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          Популярный
        </div>
      )}
      <div className="text-[28px] mb-2">{p.emoji}</div>
      <div className={cn("text-base font-bold tracking-[-0.01em] mb-1", p.popular ? "text-white" : "text-foreground")}>
        {p.name}
      </div>
      <div className={cn("text-xs mb-4", p.popular ? "text-white/70" : "text-[hsl(var(--text-tertiary))]")}>
        {p.desc}
      </div>
      <div className="flex items-baseline gap-1 mb-5">
        <span className={cn("text-[32px] font-extrabold tracking-[-0.03em]", p.popular ? "text-white" : "text-foreground")}>
          {p.price}
        </span>
        <span className={cn("text-[13px]", p.popular ? "text-white/60" : "text-[hsl(var(--text-tertiary))]")}>
          {p.period}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 mb-6 flex-1">
        {p.features.map((f) => (
          <div key={f} className={cn("flex items-center gap-2 text-[13px]", p.popular ? "text-white/90" : "text-foreground")}>
            <span
              className={cn(
                "w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] font-bold shrink-0",
                p.popular ? "bg-white/15 text-white" : "bg-[hsl(var(--accent-brand-light))] text-primary"
              )}
            >
              ✓
            </span>
            {f}
          </div>
        ))}
      </div>
      <Link href={p.href} className="block">
        {p.popular ? (
          <button className="btn-bounce w-full py-[11px] rounded-[10px] bg-white text-primary font-semibold text-sm">
            {p.cta}
          </button>
        ) : (
          <Button variant="secondary" className="w-full">{p.cta}</Button>
        )}
      </Link>
    </div>
  );
}
