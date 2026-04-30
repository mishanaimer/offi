import Link from "next/link";
import { Crown } from "lucide-react";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, FOUNDERS_PRICE, type PlanCode } from "@/lib/plans";
import { FoundersCounter } from "./founders-counter";

type Card = {
  id: PlanCode;
  emoji: string;
  desc: string;
  cta: string;
  href: string;
  popular?: boolean;
  features: string[];
  showOnLanding: boolean;
};

const CARDS: Card[] = [
  {
    id: "trial",
    emoji: "🌱",
    desc: "14 дней попробовать всё",
    cta: "Начать бесплатно",
    href: "/register",
    showOnLanding: false, // не показываем — есть отдельный CTA
    features: [],
  },
  {
    id: "start",
    emoji: "✨",
    desc: "Для микро-команд",
    cta: "Начать",
    href: "/register",
    showOnLanding: true,
    features: [
      "До 3 сотрудников",
      "800 AI-запросов/мес",
      "50 документов в базе",
      "Email + Telegram",
    ],
  },
  {
    id: "business",
    emoji: "⚡",
    desc: "Для растущих команд",
    cta: "Перейти к Бизнесу",
    href: "/register",
    showOnLanding: true,
    popular: true,
    features: [
      "До 10 сотрудников",
      "2 500 AI-запросов/мес",
      "200 документов в базе",
      "AmoCRM, Bitrix24",
      "Приоритетная поддержка",
    ],
  },
  {
    id: "team",
    emoji: "🏢",
    desc: "Для зрелых компаний",
    cta: "Связаться",
    href: "mailto:hello@offi-ai.com",
    showOnLanding: true,
    features: [
      "До 30 сотрудников",
      "6 500 AI-запросов/мес",
      "400 документов в базе",
      "1С, Google Drive",
      "SLA 99.5%",
    ],
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="max-w-[920px] mx-auto pt-[88px]">
      <Reveal>
        <div className="text-center mb-8 px-6 md:px-8">
          <p className="text-[13px] font-semibold text-primary mb-2">Тарифы</p>
          <h2 className="text-[30px] md:text-[32px] font-extrabold text-foreground tracking-[-0.035em]">
            В 2-4 раза дешевле, чем ChatGPT Team на команду
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[520px] mx-auto">
            И при этом знаем вашу компанию изнутри: документы, клиентов, договоры, переписку.
          </p>
        </div>
      </Reveal>

      <Reveal>
        <FoundersCounter />
      </Reveal>

      <div
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-4 px-6 md:px-8 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0 items-stretch"
        style={{ scrollPadding: "0 24px" }}
      >
        {CARDS.filter((c) => c.showOnLanding).map((c, i) => (
          <Reveal
            key={c.id}
            delay={i * 100}
            className="shrink-0 w-[82%] sm:w-[62%] md:w-auto snap-start"
          >
            <PlanCard card={c} />
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground px-6">
        Все тарифы — без НДС (НПД). Сверх лимита: <span className="font-medium">390 ₽</span> за 100 запросов,{" "}
        <span className="font-medium">29 ₽</span> за загрузку документа,{" "}
        <span className="font-medium">490 ₽</span> за дополнительного сотрудника.
      </p>

      <div className="flex md:hidden justify-center gap-1.5 mt-2">
        {CARDS.filter((c) => c.showOnLanding).map((c) => (
          <span key={c.id} className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--border))]" aria-hidden />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ card }: { card: Card }) {
  const def = PLANS[card.id];
  const stdPrice = def.priceMonth;
  const founderPrice = (FOUNDERS_PRICE as Record<string, number>)[card.id];
  const hasFounder = typeof founderPrice === "number";

  return (
    <div
      className={cn(
        "relative rounded-[18px] p-6 md:p-7 border card-hover h-full flex flex-col",
        card.popular ? "bg-primary border-primary" : "bg-card border-border hover:border-[hsl(var(--accent-brand-mid))]"
      )}
    >
      {card.popular && (
        <div
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-white text-primary text-[11px] font-bold whitespace-nowrap"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          Популярный
        </div>
      )}
      <div className="text-[28px] mb-2">{card.emoji}</div>
      <div className={cn("text-base font-bold tracking-[-0.01em] mb-1", card.popular ? "text-white" : "text-foreground")}>
        {def.name}
      </div>
      <div className={cn("text-xs mb-4", card.popular ? "text-white/70" : "text-[hsl(var(--text-tertiary))]")}>
        {card.desc}
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-[32px] font-extrabold tracking-[-0.03em] tabular-nums", card.popular ? "text-white" : "text-foreground")}>
            {stdPrice.toLocaleString("ru")}
          </span>
          <span className={cn("text-[13px]", card.popular ? "text-white/60" : "text-[hsl(var(--text-tertiary))]")}>
            ₽/мес
          </span>
        </div>
        {hasFounder && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px]">
            <Crown className={cn("w-3.5 h-3.5", card.popular ? "text-amber-300" : "text-amber-600")} />
            <span className={cn("font-semibold", card.popular ? "text-amber-200" : "text-amber-700")}>
              Founders: {founderPrice.toLocaleString("ru")} ₽
            </span>
            <span className={cn(card.popular ? "text-white/60" : "text-muted-foreground")}>пожизненно</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 mb-6 flex-1">
        {card.features.map((f) => (
          <div
            key={f}
            className={cn("flex items-center gap-2 text-[13px]", card.popular ? "text-white/90" : "text-foreground")}
          >
            <span
              className={cn(
                "w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] font-bold shrink-0",
                card.popular ? "bg-white/15 text-white" : "bg-[hsl(var(--accent-brand-light))] text-primary"
              )}
            >
              ✓
            </span>
            {f}
          </div>
        ))}
      </div>

      <Link href={card.href} className="block">
        {card.popular ? (
          <button className="btn-bounce w-full py-[11px] rounded-[10px] bg-white text-primary font-semibold text-sm">
            {card.cta}
          </button>
        ) : (
          <Button variant="secondary" className="w-full">
            {card.cta}
          </Button>
        )}
      </Link>
    </div>
  );
}
