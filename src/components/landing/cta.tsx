import Link from "next/link";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";
import { BrandMorph } from "@/components/mascot";
import { ArrowRight } from "lucide-react";

export function LandingCta() {
  return (
    <Reveal from="scale" className="max-w-[580px] mx-auto px-6 md:px-8 pt-[88px]">
      <div
        className="relative overflow-hidden rounded-[24px] bg-card border border-border text-center px-10 py-12 showcase-plastic"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 16px 48px rgba(2,89,221,0.04)" }}
      >
        <div
          className="absolute -top-16 -left-16 w-56 h-56 rounded-full pointer-events-none anim-halo"
          style={{ background: "radial-gradient(closest-side, rgba(26,86,255,0.12), transparent 70%)" }}
          aria-hidden
        />
        <div
          className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full pointer-events-none anim-halo"
          style={{
            background: "radial-gradient(closest-side, rgba(132,175,251,0.22), transparent 70%)",
            animationDelay: "2.4s",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-2">
          <BrandMorph size={44} startState="robot" autoCycle cycleInterval={7.5} startDelay={2.6} interactive phase={3.1} />
          <h2 className="mt-4 text-[26px] md:text-[28px] font-extrabold text-foreground tracking-[-0.03em]">
            Готовы начать?
          </h2>
          <p className="text-[15px] text-muted-foreground leading-[1.6] mb-6 max-w-[360px]">
            Подключите Offi за 5 минут. Первые 14 дней — бесплатно, без карты.
          </p>
          <Link href="/register">
            <Button size="lg" className="text-[15px]">
              Создать аккаунт <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-[hsl(var(--text-tertiary))]">
            Оффи уже готовит рабочее место ⚡
          </p>
        </div>
      </div>
    </Reveal>
  );
}
