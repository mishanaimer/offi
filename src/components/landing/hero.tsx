"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMorph } from "@/components/mascot";
import { DemoChat } from "./demo-chat";
import { Sparkles, ArrowRight } from "lucide-react";

function useResponsiveSize(vw: number, min: number, max: number) {
  const [s, setS] = useState(max);
  useEffect(() => {
    const calc = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 1200;
      setS(Math.round(Math.min(max, Math.max(min, (w * vw) / 100))));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [vw, min, max]);
  return s;
}

export function LandingHero() {
  // Размер brand-morph в hero — плавно scaled между мобилкой и десктопом,
  // как в референсе mascot-morph.html (clamp(60, 12vw, 130)).
  const morphSize = useResponsiveSize(12, 62, 118);

  return (
    <section className="relative overflow-hidden">
      {/* Фоновые акценты — мягкие радиальные подсветки, как в референсе */}
      <div
        className="absolute inset-x-0 top-0 h-[560px] pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 420px at 50% -10%, hsl(var(--accent-brand-light)) 0%, transparent 60%), radial-gradient(700px 400px at 90% 40%, rgba(132,175,251,0.18) 0%, transparent 65%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-[720px] mx-auto px-6 md:px-8 pt-12 md:pt-16 text-center">
        {/* Beta badge with sheen */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent-brand-light))] text-primary px-3.5 py-1 text-xs font-semibold anim-fade-up relative overflow-hidden"
          style={{ animationDelay: "0ms" }}
        >
          <Sparkles className="w-3.5 h-3.5" /> Бета-доступ открыт
          <span className="absolute inset-0 anim-sheen pointer-events-none" aria-hidden />
        </div>

        {/* Brand morph showcase — главный визуальный якорь */}
        <div
          className="relative mt-7 mx-auto flex items-end justify-center anim-fade-up showcase-plastic"
          style={{ animationDelay: "120ms", minHeight: morphSize * 1.45 }}
        >
          {/* Halo: «дыхание» сине-синей подсветки за маскотом */}
          <div
            className="absolute left-1/2 top-1/2 w-[80%] max-w-[560px] aspect-square rounded-full pointer-events-none anim-halo"
            style={{
              background:
                "radial-gradient(closest-side, rgba(26,86,255,0.18), transparent 70%)",
              filter: "blur(8px)",
              transform: "translate(-50%, -50%)",
            }}
            aria-hidden
          />
          {/* Плавающие «пузырьки» — «знает», «отвечает», «действует» */}
          <FloatingBubble
            text="знает"
            className="left-[4%] md:left-[10%] top-[8%]"
            delay="0s"
            rot="-4deg"
          />
          <FloatingBubble
            text="действует"
            className="right-[4%] md:right-[10%] top-[18%]"
            delay="1.3s"
            rot="4deg"
          />
          <FloatingBubble
            text="помогает"
            className="left-[14%] md:left-[22%] bottom-[0%]"
            delay="2.1s"
            rot="-2deg"
          />
          <BrandMorph
            size={morphSize}
            startState="text"
            autoCycle
            cycleInterval={6.2}
            startDelay={1.1}
            hoverMorph={false}
            interactive
            showcaseMode
            phase={1.7}
          />
        </div>

        {/* Heading */}
        <h1
          className="mt-8 text-[36px] md:text-[52px] font-extrabold text-foreground leading-[1.06] tracking-[-0.045em] anim-fade-up"
          style={{ animationDelay: "280ms" }}
        >
          AI, который знает<br />
          <span className="text-primary">ваш бизнес</span>
        </h1>

        {/* Sub */}
        <p
          className="mt-4 text-[16px] md:text-[18px] text-muted-foreground max-w-[460px] mx-auto leading-[1.6] anim-fade-up"
          style={{ animationDelay: "420ms" }}
        >
          Загрузите документы — получите ассистента. Письма, договоры, встречи — в одном чате.
        </p>

        {/* CTAs */}
        <div
          className="mt-8 flex gap-2.5 justify-center anim-fade-up"
          style={{ animationDelay: "560ms" }}
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
          style={{ animationDelay: "700ms" }}
        >
          Без карты · 14 дней бесплатно · Настройка за 5 минут
        </p>
      </div>

      {/* Chat demo */}
      <div className="relative max-w-[520px] mx-auto px-6 md:px-8 mt-10 anim-scale-in" style={{ animationDelay: "820ms" }}>
        <DemoChat />
      </div>
    </section>
  );
}

function FloatingBubble({
  text,
  className,
  delay,
  rot,
}: {
  text: string;
  className?: string;
  delay: string;
  rot: string;
}) {
  return (
    <div
      className={`hidden sm:block absolute px-3 py-1 rounded-full bg-card border border-[hsl(var(--border-light))] text-[11px] font-semibold text-primary anim-bubble-float pointer-events-none z-10 ${className || ""}`}
      style={{
        animationDelay: delay,
        // @ts-expect-error css custom prop
        "--rot": rot,
        transform: `rotate(${rot})`,
        boxShadow: "0 6px 18px rgba(2,89,221,0.08)",
      }}
      aria-hidden
    >
      {text}
    </div>
  );
}
