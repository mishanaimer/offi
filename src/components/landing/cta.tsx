import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingCta() {
  return (
    <section className="py-20 md:py-28 border-t border-border">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-foreground text-background p-10 md:p-16">
          <div aria-hidden className="absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full bg-primary/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Внедрите AI-ассистента за 14 минут.
            </h2>
            <p className="mt-4 text-base md:text-lg text-background/70">
              Загрузите несколько документов, задайте первый вопрос — и почувствуйте разницу.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg" className="bg-background text-foreground hover:bg-background/90">
                  Начать бесплатно
                </Button>
              </Link>
              <a href="mailto:hello@offi.ai">
                <Button size="lg" variant="outline" className="border-background/20 text-background hover:bg-background/10">
                  Говорить с человеком
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
