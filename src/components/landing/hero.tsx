"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DemoChat } from "./demo-chat";
import { Sparkles, ArrowRight } from "lucide-react";

export function LandingHero() {
  return (
    <section className="relative">
      <div className="max-w-[680px] mx-auto px-6 md:px-8 pt-16 md:pt-20 text-center">
        {/* Beta badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent-brand-light))] text-primary px-3.5 py-1 text-xs font-semibold anim-fade-up">
          <Sparkles className="w-3.5 h-3.5" /> Бета-доступ открыт
        </div>

        {/* Heading */}
        <h1
          className="mt-6 text-[40px] md:text-[52px] font-extrabold text-foreground leading-[1.08] tracking-[-0.045em] anim-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          AI, который знает<br />
          <span className="text-primary">ваш бизнес</span>
        </h1>

        {/* Sub */}
        <p
          className="mt-4 text-[17px] md:text-[18px] text-muted-foreground max-w-[440px] mx-auto leading-[1.65] anim-fade-up"
          style={{ animationDelay: "280ms" }}
        >
          Загрузите документы — получите ассистента. Письма, договоры, встречи — в одном чате.
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex gap-2.5 justify-center anim-fade-up"
          style={{ animationDelay: "420ms" }}
        >
          <Link href="/register">
            <Button size="md">Попробовать бесплатно <ArrowRight className="w-4 h-4" /></Button>
          </Link>
          <a href="#how">
            <Button variant="secondary" size="md">Как это работает</Button>
          </a>
        </div>
        <p
          className="mt-3.5 text-xs text-[hsl(var(--text-tertiary))] tracking-[-0.01em] anim-fade-up"
          style={{ animationDelay: "560ms" }}
        >
          Без карты · 14 дней бесплатно · Настройка за 5 минут
        </p>
      </div>

      {/* Chat demo */}
      <div className="max-w-[520px] mx-auto px-6 md:px-8 mt-12 anim-scale-in" style={{ animationDelay: "640ms" }}>
        <DemoChat />
      </div>
    </section>
  );
}
