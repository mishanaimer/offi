"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  BookOpen,
  Users as UsersIcon,
  FileText,
  MessagesSquare,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { useBranding } from "@/components/branding-provider";
import { MascotAvatar } from "@/components/mascot";
import { ApiErrorBanner } from "@/components/api-health";

export type AppUser = { id: string; email: string; fullName: string; isSuperadmin?: boolean };

const NAV = [
  { href: "/chat", label: "Чат", icon: MessageSquare },
  { href: "/knowledge", label: "База знаний", icon: BookOpen },
  { href: "/clients", label: "Клиенты", icon: UsersIcon },
  { href: "/documents", label: "Документы", icon: FileText },
  { href: "/team", label: "Команда", icon: MessagesSquare },
  { href: "/settings", label: "Настройки", icon: Settings },
];

const MOBILE_NAV = NAV.slice(0, 5);

export function AppShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const brand = useBranding();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const companyInitial = brand.companyName.trim()[0]?.toUpperCase() ?? "O";

  return (
    <div className="h-dvh bg-background flex overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border/60 flex-col bg-card/40">
        {/* header: company */}
        <div className="px-4 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            {brand.logoUrl ? (
              <Image
                src={brand.logoUrl}
                alt={brand.companyName}
                width={36}
                height={36}
                className="rounded-xl object-cover shrink-0"
              />
            ) : (
              <span
                className="w-9 h-9 rounded-xl grid place-items-center text-white text-[15px] font-semibold shrink-0"
                style={{ background: brand.accentColor }}
                aria-hidden
              >
                {companyInitial}
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[15px] font-bold leading-tight truncate">{brand.companyName}</div>
              <div className="text-[10px] tracking-wider uppercase text-[hsl(var(--text-tertiary))]">offi.ai</div>
            </div>
          </div>

          {/* assistant block */}
          <div className="mt-4 flex items-center gap-2.5 rounded-xl px-2.5 py-2 bg-muted/60">
            <MascotAvatar size={34} />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground leading-none">Ассистент</div>
              <div className="text-[13px] font-medium leading-tight truncate mt-0.5">{brand.assistantName}</div>
            </div>
          </div>
        </div>

        <nav className="px-3 pt-3 flex flex-col gap-1 flex-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 h-10 text-sm transition",
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={active ? { background: `color-mix(in srgb, ${brand.accentColor} 12%, transparent)` } : undefined}
              >
                <item.icon
                  className="w-4 h-4"
                  style={active ? { color: brand.accentColor } : undefined}
                />{" "}
                {item.label}
              </Link>
            );
          })}

          {user.isSuperadmin && (
            <Link
              href="/admin"
              className={cn(
                "mt-2 flex items-center gap-2.5 rounded-xl px-3 h-10 text-sm transition border border-destructive/20",
                pathname.startsWith("/admin")
                  ? "text-destructive font-medium bg-destructive/10"
                  : "text-destructive/80 hover:bg-destructive/10"
              )}
            >
              <Shield className="w-4 h-4" /> Админка
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div
              className="w-8 h-8 rounded-full grid place-items-center text-xs font-medium text-white shrink-0"
              style={{ background: `color-mix(in srgb, ${brand.accentColor} 85%, #000 0%)` }}
            >
              {initials(user.fullName || user.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.fullName || "Вы"}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-md hover:bg-muted"
              aria-label="Выйти"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0">
        <ApiErrorBanner />
        {children}
      </main>

      {/* Mobile tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 h-16">
          {MOBILE_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
                style={active ? { color: brand.accentColor } : undefined}
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
