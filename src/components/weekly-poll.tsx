"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "offi_weekly_poll_dismissed";

const USAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Не пользовался(ась)" },
  { value: "1-2", label: "1-2 раза" },
  { value: "3-5", label: "3-5 раз" },
  { value: "6-10", label: "6-10 раз" },
  { value: "10+", label: "Больше 10 раз" },
];

export function WeeklyPoll() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"q1" | "q2" | "q3" | "thanks">("q1");
  const [usage, setUsage] = useState<string>("");
  const [worked, setWorked] = useState("");
  const [pain, setPain] = useState("");
  const [pending, setPending] = useState(false);
  const [week, setWeek] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feedback/weekly", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.show) return;
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed === d.week) return; // user dismissed this week — show again next week
        setWeek(d.week);
        setTimeout(() => setShow(true), 2500);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    if (week) {
      try {
        localStorage.setItem(STORAGE_KEY, week);
      } catch {}
    }
    setShow(false);
  }

  async function submit() {
    setPending(true);
    try {
      await fetch("/api/feedback/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q_usage: usage, q_worked: worked, q_pain: pain }),
      });
      setStep("thanks");
      if (week) {
        try {
          localStorage.setItem(STORAGE_KEY, week);
        } catch {}
      }
      setTimeout(() => setShow(false), 1800);
    } finally {
      setPending(false);
    }
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Еженедельный опрос пилота"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-[400px] z-40 print:hidden"
    >
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-white shadow-[0_20px_50px_-15px_rgba(2,89,221,0.22)] p-5 anim-fade-up">
        <div className="flex items-start gap-3 mb-3">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent-brand-light))] text-primary">
            <Sparkles size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">Pilot-feedback</div>
            <h3 className="text-[15px] font-semibold text-foreground leading-snug">
              {step === "thanks" ? "Спасибо! 🙌" : "Минута на отзыв?"}
            </h3>
          </div>
          {step !== "thanks" && (
            <button
              type="button"
              onClick={dismiss}
              aria-label="Закрыть"
              className="-mr-1 -mt-1 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-alt))]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {step === "q1" && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Сколько раз за неделю Offi реально сэкономил время?
            </p>
            <div className="flex flex-col gap-1.5">
              {USAGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setUsage(o.value);
                    setStep("q2");
                  }}
                  className={cn(
                    "text-left text-[13.5px] px-3 py-2 rounded-lg border transition-colors",
                    usage === o.value
                      ? "border-primary bg-[hsl(var(--accent-brand-light))] text-primary"
                      : "border-border bg-background hover:border-primary/40 hover:bg-[hsl(var(--surface-alt))]"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "q2" && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">Что зашло на этой неделе?</p>
            <textarea
              value={worked}
              onChange={(e) => setWorked(e.target.value)}
              placeholder="например: AI быстро нашёл клиента по неполному имени..."
              className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-[hsl(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("q1")}
                className="text-[12.5px] text-muted-foreground hover:text-foreground"
              >
                ← назад
              </button>
              <button
                type="button"
                onClick={() => setStep("q3")}
                className="btn-bounce inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-medium text-white hover:bg-[hsl(var(--accent-brand-hover))]"
              >
                Дальше
              </button>
            </div>
          </div>
        )}

        {step === "q3" && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">Что не получилось / бесило?</p>
            <textarea
              value={pain}
              onChange={(e) => setPain(e.target.value)}
              placeholder="например: долго грузил большой PDF, ответ AI был не из того документа..."
              className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-[hsl(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("q2")}
                className="text-[12.5px] text-muted-foreground hover:text-foreground"
              >
                ← назад
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="btn-bounce inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-medium text-white hover:bg-[hsl(var(--accent-brand-hover))] disabled:opacity-60"
              >
                {pending ? "Отправляем…" : "Отправить"}
              </button>
            </div>
          </div>
        )}

        {step === "thanks" && (
          <p className="text-[13px] text-muted-foreground">
            Ваш отзыв виден в нашей админке. На созвоне разберём подробнее. 🚀
          </p>
        )}
      </div>
    </div>
  );
}
