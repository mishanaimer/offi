"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMorph } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 transition-all duration-300 h-14 px-4 md:px-8 flex items-center justify-between",
        scrolled ? "glass-scrolled border-b border-border" : "glass border-b border-transparent"
      )}
    >
      <div className="flex items-center gap-4 md:gap-8">
        <Link href="/" className="transition-transform duration-300 hover:scale-[1.03]">
          {/* Маскот в хедере: text-state по дефолту, на hover → robot + joy.
              autoCycle=false, чтобы не отвлекать при скролле.
              phase=0 — свой уникальный ритм; hero ниже имеет phase=1.7. */}
          <BrandMorph
            size={20}
            startState="text"
            autoCycle={false}
            hoverMorph
            interactive
            phase={0}
          />
        </Link>
        <div className="hidden md:flex gap-6 text-[13px] font-medium text-muted-foreground">
          <a href="#features" className="link-hover cursor-pointer">Возможности</a>
          <a href="#how" className="link-hover cursor-pointer">Как работает</a>
          <a href="#pricing" className="link-hover cursor-pointer">Тарифы</a>
          <a href="#faq" className="link-hover cursor-pointer">FAQ</a>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden sm:inline-flex">
          <Button variant="ghost" size="sm">Войти</Button>
        </Link>
        <Link href="/register">
          <Button size="sm">Начать</Button>
        </Link>
      </div>
    </nav>
  );
}
