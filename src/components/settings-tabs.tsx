"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBranding } from "@/components/branding-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "Бренд и интеграции" },
  { href: "/settings/plans", label: "Тарифы" },
  { href: "/settings/team", label: "Сотрудники" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const brand = useBranding();

  return (
    <div className="border-b border-border/60 bg-background sticky top-16 z-[5]">
      <div className="container-page max-w-3xl">
        <nav className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "shrink-0 px-3 md:px-4 h-11 inline-flex items-center text-[13px] md:text-sm border-b-2 transition",
                  active
                    ? "font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                style={
                  active
                    ? { borderColor: brand.accentColor, color: brand.accentColor }
                    : undefined
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
