"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, X, Check, Bug } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useBranding } from "@/components/branding-provider";

type Severity = "low" | "normal" | "high" | "critical";

/**
 * Глобальный оверлей «!» в правом нижнем углу: наведение — подсказка,
 * клик — модалка с отправкой багрепорта. Данные уходят в bug_reports
 * вместе с URL страницы, user-agent и последними ошибками из консоли.
 */
export function BugReportOverlay() {
  const brand = useBranding();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [error, setError] = useState<string | null>(null);

  // Собираем последние ошибки из консоли, чтобы приложить к обращению.
  const errorsRef = useRef<string[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = console.error;
    const onErr = (e: ErrorEvent) => {
      errorsRef.current = [
        ...errorsRef.current.slice(-9),
        `[error] ${e.message} @ ${e.filename}:${e.lineno}`,
      ];
    };
    const onRej = (e: PromiseRejectionEvent) => {
      errorsRef.current = [
        ...errorsRef.current.slice(-9),
        `[unhandled] ${String(e.reason?.message ?? e.reason)}`,
      ];
    };
    console.error = (...args: unknown[]) => {
      try {
        errorsRef.current = [
          ...errorsRef.current.slice(-9),
          `[console] ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ")}`,
        ];
      } catch {}
      orig(...(args as Parameters<typeof console.error>));
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      console.error = orig;
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || null,
          message: message.trim(),
          severity,
          pageUrl: typeof window !== "undefined" ? window.location.href : pathname,
          details: {
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            screen:
              typeof window !== "undefined"
                ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
                : null,
            referrer: typeof document !== "undefined" ? document.referrer : null,
            console_errors: errorsRef.current.slice(-10),
            pathname,
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
      }
      setSent(true);
      setMessage("");
      setSubject("");
      setSeverity("normal");
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1800);
    } catch (e) {
      setError((e as Error).message || "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  // Не показываем на лендинге/логине
  if (
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/register") ||
    pathname?.startsWith("/onboarding")
  ) {
    return null;
  }

  return (
    <>
      {/* Floating trigger. На мобильном поднят над таб-баром (64px) и учитывает safe-area. */}
      <div
        className="fixed z-40 bottom-4 right-4 md:bottom-5 md:right-5"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group md:mb-0 mb-16 h-10 rounded-full border border-border/70 bg-card/95 backdrop-blur shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_22px_rgba(0,0,0,0.12)] transition-all flex items-center pl-2 pr-3 gap-2 overflow-hidden"
          aria-label="Сообщить об ошибке"
          title="Сообщить об ошибке"
        >
          <span
            className="w-7 h-7 rounded-full grid place-items-center text-white shrink-0"
            style={{ background: "#F59E0B" }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
          <span className="max-w-0 opacity-0 group-hover:max-w-[220px] group-hover:opacity-100 transition-all whitespace-nowrap text-[13px] font-medium text-foreground">
            Сообщить об ошибке
          </span>
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !sending && setOpen(false)}
            aria-hidden
          />
          <form
            onSubmit={submit}
            className="relative w-full max-w-md rounded-2xl bg-card border border-border/60 shadow-2xl overflow-hidden"
          >
            <header
              className="px-5 py-4 border-b border-border/60 flex items-start justify-between gap-3"
              style={{
                background: `color-mix(in srgb, ${brand.accentColor} 6%, transparent)`,
              }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${brand.accentColor} 14%, transparent)`,
                    color: brand.accentColor,
                  }}
                >
                  <Bug className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] leading-tight">
                    Сообщить об ошибке
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1">
                    Команда {brand.assistantName === "Оффи" ? "Offi" : brand.assistantName} разберёт обращение. URL и контекст страницы приложим автоматически.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !sending && setOpen(false)}
                className="p-1 rounded-md hover:bg-muted shrink-0"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {sent ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center">
                  <Check className="w-5 h-5" />
                </div>
                <div className="mt-3 font-medium">Обращение отправлено</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Спасибо — команда уже видит вашу заявку.
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium">
                    Тема (необязательно)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Например: не грузит база знаний"
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-foreground/40"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium">
                    Что пошло не так?
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="Опишите шаги, чтобы мы могли воспроизвести ошибку"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-foreground/40 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium">
                    Срочность
                  </label>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { v: "low", l: "Низкая" },
                        { v: "normal", l: "Обычная" },
                        { v: "high", l: "Высокая" },
                        { v: "critical", l: "Критично" },
                      ] as Array<{ v: Severity; l: string }>
                    ).map((opt) => {
                      const active = severity === opt.v;
                      return (
                        <button
                          type="button"
                          key={opt.v}
                          onClick={() => setSeverity(opt.v)}
                          className={cn(
                            "h-9 rounded-lg border text-[12px] font-medium transition",
                            active
                              ? "text-white border-transparent"
                              : "border-border bg-card hover:bg-muted text-muted-foreground"
                          )}
                          style={
                            active
                              ? {
                                  background:
                                    opt.v === "critical"
                                      ? "hsl(var(--destructive))"
                                      : opt.v === "high"
                                      ? "#F59E0B"
                                      : brand.accentColor,
                                }
                              : undefined
                          }
                        >
                          {opt.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-3 py-2 text-[12px]">
                    {error}
                  </div>
                )}
              </div>
            )}

            {!sent && (
              <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="rounded-full px-4 h-9 text-[13px] hover:bg-muted disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="rounded-full px-4 h-9 text-[13px] font-medium text-white disabled:opacity-60 inline-flex items-center gap-2"
                  style={{ background: brand.accentColor }}
                >
                  {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Отправить
                </button>
              </footer>
            )}
          </form>
        </div>
      )}
    </>
  );
}
