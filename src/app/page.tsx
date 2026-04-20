import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/landing/hero";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFaq } from "@/components/landing/faq";
import { LandingCta } from "@/components/landing/cta";

export default function LandingPage() {
  return (
    <main className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Возможности</a>
            <a href="#pricing" className="hover:text-foreground">Тарифы</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">Войти</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Попробовать</Button>
            </Link>
          </div>
        </div>
      </header>

      <LandingHero />
      <LandingFeatures />
      <LandingPricing />
      <LandingFaq />
      <LandingCta />

      <footer className="border-t border-border/60 py-10 text-sm text-muted-foreground">
        <div className="container-page flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Logo size={18} /><span>© 2026 Offi</span></div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">Конфиденциальность</a>
            <a href="#" className="hover:text-foreground">Условия</a>
            <a href="mailto:hello@offi.ai" className="hover:text-foreground">hello@offi.ai</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
