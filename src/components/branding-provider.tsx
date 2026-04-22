"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

export type Branding = {
  companyId: string;
  companyName: string;
  assistantName: string;
  accentColor: string;       // HEX, #RRGGBB
  assistantColor: string;    // HEX, для аватарки ассистента
  assistantIcon: string;     // sparkles | bot | zap | star | flame
  welcomeMessage: string;    // приветствие в пустом чате
  logoUrl: string | null;
  role: "owner" | "admin" | "member";
};

const BrandingContext = createContext<Branding | null>(null);

const DEFAULT_ACCENT = "#1a6eff";

export function BrandingProvider({
  value,
  children,
}: {
  value: Branding;
  children: React.ReactNode;
}) {
  const data = useMemo<Branding>(
    () => ({
      ...value,
      accentColor: value.accentColor || DEFAULT_ACCENT,
      assistantColor: value.assistantColor || value.accentColor || DEFAULT_ACCENT,
      assistantIcon: value.assistantIcon || "sparkles",
      welcomeMessage:
        value.welcomeMessage ||
        `Привет! Я ${value.assistantName}. Спросите что-нибудь о вашем бизнесе.`,
    }),
    [value]
  );

  useEffect(() => {
    const root = document.documentElement;
    const hsl = hexToHsl(data.accentColor);
    if (hsl) {
      root.style.setProperty("--accent", data.accentColor);
      root.style.setProperty("--accent-brand", hsl);
    }
    const aHsl = hexToHsl(data.assistantColor);
    if (aHsl) {
      root.style.setProperty("--assistant-accent", data.assistantColor);
      root.style.setProperty("--assistant-accent-hsl", aHsl);
    }
    return () => {
      // при размонтировании (выход в /login) сбрасываем к дефолту лендинга
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-brand");
      root.style.removeProperty("--assistant-accent");
      root.style.removeProperty("--assistant-accent-hsl");
    };
  }, [data.accentColor, data.assistantColor]);

  return <BrandingContext.Provider value={data}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used inside <BrandingProvider>");
  }
  return ctx;
}

export function hexToHsl(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
