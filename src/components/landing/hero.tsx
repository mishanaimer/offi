"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DemoChat } from "./demo-chat";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* субтильное сияние */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--accent-brand)/0.18),transparent)] blur-3xl" />
      <div className="container-page pt-16 md:pt-28 pb-10 md:pb-16 relative">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              Бета · присоединяйтесь
            </div>
            <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              AI-ассистент,<br/>
              <span className="text-primary">который знает ваш бизнес</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-[520px] leading-relaxed">
              Загрузите документы, сайт, клиентов — и общайтесь как с ChatGPT.
              Но ваш ассистент умеет действовать: писать письма, назначать встречи, генерировать договоры.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg">Попробовать бесплатно</Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg">Как это работает</Button>
              </a>
            </div>
            <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
              <span>14 дней бесплатно</span>
              <span>•</span>
              <span>Без карты</span>
              <span>•</span>
              <span>Оплата рублями</span>
            </div>
          </div>

          <div className="animate-fade-in [animation-delay:150ms]">
            <DemoChat />
          </div>
        </div>
      </div>
    </section>
  );
}
