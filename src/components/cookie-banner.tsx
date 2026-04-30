"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "offi_cookie_acknowledged";
const TTL_DAYS = 365;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const t = window.setTimeout(() => setVisible(true), 600);
        return () => window.clearTimeout(t);
      }
      const ts = Number(raw);
      if (!Number.isFinite(ts) || Date.now() - ts > TTL_DAYS * 24 * 60 * 60 * 1000) {
        setVisible(true);
      }
    } catch {
      // localStorage недоступен (privacy mode) — баннер не критичен, не показываем повторно в той же сессии
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Уведомление о cookie"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-[420px] z-50 print:hidden"
    >
      <div
        className="rounded-2xl border border-[hsl(var(--border))] bg-white shadow-[0_20px_40px_-15px_rgba(2,89,221,0.18)] p-4 sm:p-5 anim-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent-brand-light))] text-primary">
            <Cookie size={18} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-foreground">Cookie на сайте</h3>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
              Мы используем строго необходимые cookie для аутентификации и безопасности. Аналитических трекеров на сайте нет.
              Подробнее в{" "}
              <Link href="/legal/cookies" className="text-primary hover:underline">
                Политике cookie
              </Link>
              .
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="btn-bounce mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[hsl(var(--accent-brand-hover))]"
            >
              Понятно
            </button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Закрыть"
            className="-mr-1 -mt-1 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-alt))] hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
