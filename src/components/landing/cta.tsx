import Link from "next/link";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingCta() {
  return (
    <Reveal from="scale" className="max-w-[580px] mx-auto px-6 md:px-8 pt-[88px]">
      <div
        className="rounded-[24px] bg-card border border-border text-center px-10 py-12"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 16px 48px rgba(2,89,221,0.04)" }}
      >
        <div className="text-[36px] mb-4">🚀</div>
        <h2 className="text-[26px] md:text-[28px] font-extrabold text-foreground tracking-[-0.03em] mb-2">
          Готовы начать?
        </h2>
        <p className="text-[15px] text-muted-foreground leading-[1.6] mb-7">
          Подключите Offi за 5 минут. Первые 14 дней — бесплатно.
        </p>
        <Link href="/register">
          <Button size="lg" className="text-[15px]">
            Создать аккаунт <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </Reveal>
  );
}
