"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  BookOpen,
  Users as UsersIcon,
  FileText,
  MessagesSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { useEffect } from "react";

export type AppUser = { id: string; email: string; fullName: string };
export type AppCompany = { id: string; name: string; assistantName: string; brandAccent?: string };

const NAV = [
  { href: "/chat", label: "Чат", icon: MessageSquare },
  { href: "/knowledge", label: "База знаний", icon: BookOpen },
  { href: "/clients", label: "Клиенты", icon: UsersIcon },
  { href: "/documents", label: "Документы", icon: FileText },
  { href: "/team", label: "Команда", icon: MessagesSquare },
  { href: "/settings", label: "Настройки", icon: Settings },
];

const MOBILE_NAV = NAV.slice(0, 5);

export function AppShell({
  children,
  user,
  company,
}: {
  children: React.ReactNode;
  user: AppUser;
  company: AppCompany;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // пробрасываем бренд-акцент компании в CSS-переменную (если кастомизирован)
  useEffect(() => {
    if (!company.brandAccent) return;
    try {
      const hsl = hexToHsl(company.brandAccent);
      if (hsl) document.documentElement.style.setProperty("--accent-brand", hsl);
    } catch {}
  }, [company.brandAccent]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-background flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border/60 flex-col">
        <div className="h-16 flex items-center px-4">
          <Logo />
        </div>

        <div className="px-3 pb-3">
          <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Компания</div>
            <div className="font-medium truncate">{company.name}</div>
            <div className="mt-0.5 text-muted-foreground">Ассистент: {company.assistantName}</div>
          </div>
        </div>

        <nav className="px-3 flex flex-col gap-1 flex-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 h-10 text-sm text-muted-foreground transition",
                  active && "bg-muted text-foreground font-medium",
                  "hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">
              {initials(user.fullName || user.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.fullName || "Вы"}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
            <button onClick={signOut} className="p-1.5 rounded-md hover:bg-muted" aria-label="Выйти">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </aside>

      {/* Контент */}
      <main className="flex-1 flex flex-col min-h-dvh pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0">
        {children}
      </main>

      {/* Mobile tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur border-t border-border safe-bottom">
        <div className="grid grid-cols-5 h-16">
          {MOBILE_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function initials(s: string) {
  return s
    .split(/[\s@]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function hexToHsl(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  let r = parseInt(m[1], 16) / 255;
  let g = parseInt(m[2], 16) / 255;
  let b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
