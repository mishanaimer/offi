import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Пробный",
    price: "0 ₽",
    period: "14 дней",
    features: ["50 запросов", "1 сотрудник", "10 документов", "5 действий"],
    cta: "Начать",
    href: "/register",
  },
  {
    name: "Старт",
    price: "2 490 ₽",
    period: "в месяц",
    features: ["500 запросов", "3 сотрудника", "50 документов", "50 действий", "Email + Telegram"],
    cta: "Попробовать",
    href: "/register",
  },
  {
    name: "Бизнес",
    price: "5 990 ₽",
    period: "в месяц",
    badge: "Популярный",
    features: ["3 000 запросов", "10 сотрудников", "300 документов", "500 действий", "CRM-интеграции"],
    cta: "Попробовать",
    href: "/register",
    highlight: true,
  },
  {
    name: "Команда",
    price: "11 990 ₽",
    period: "в месяц",
    features: ["15 000 запросов", "30 сотрудников", "∞ документов", "3 000 действий", "1С + API"],
    cta: "Связаться",
    href: "mailto:hello@offi.ai",
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 border-t border-border bg-muted/30">
      <div className="container-page">
        <div className="max-w-2xl">
          <div className="text-sm text-primary font-medium">Тарифы</div>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            Честные цены. Без скрытых комиссий.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Маржа на AI — 55–83% даже на самом активном тарифе. Можно докупить 1000 запросов за 990 ₽.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "card-surface p-6 flex flex-col",
                p.highlight && "ring-1 ring-primary shadow-[var(--shadow-md)]"
              )}
            >
              {p.badge && (
                <span className="self-start rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium mb-2">
                  {p.badge}
                </span>
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-sm text-muted-foreground">/{p.period}</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-foreground/90">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className="mt-6">
                <Button className="w-full" variant={p.highlight ? "default" : "outline"}>
                  {p.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
