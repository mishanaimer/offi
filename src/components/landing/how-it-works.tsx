"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { FileText, FileSpreadsheet, Globe, Upload, Sparkles, Check, Mail, FileDown } from "lucide-react";

// 3 анимационные сцены, по одной на шаг. Все сцены — «живые», крутятся сами
// по себе, но запускаются только когда карточка появилась во viewport
// (чтобы не жечь GPU на всём лендинге).

export function LandingHowItWorks() {
  return (
    <section id="how" className="max-w-[920px] mx-auto px-6 md:px-8 pt-[88px]">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[13px] font-semibold text-primary mb-2 tracking-[-0.01em]">Как это работает</p>
          <h2 className="text-[30px] md:text-[32px] font-extrabold text-foreground leading-[1.15] tracking-[-0.035em]">
            Три шага до результата
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-[420px] mx-auto">
            Наведите курсор на любой шаг — анимация покажет, что происходит.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <Reveal delay={0}>
          <StepCard step="01" title="Загрузите" desc="Документы, шаблоны, прайсы. Можно перетащить, вставить URL или текст.">
            <UploadScene />
          </StepCard>
        </Reveal>
        <Reveal delay={110}>
          <StepCard step="02" title="Спросите" desc="Пишите задачи как коллеге: «подготовь договор», «напиши клиенту».">
            <AskScene />
          </StepCard>
        </Reveal>
        <Reveal delay={220}>
          <StepCard step="03" title="Готово" desc="Offi сам найдёт нужное, соберёт документ и отправит от вашего имени.">
            <DoneScene />
          </StepCard>
        </Reveal>
      </div>
    </section>
  );
}

function StepCard({
  step,
  title,
  desc,
  children,
}: {
  step: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 md:p-6 h-full group">
      <div
        className="absolute top-3 right-4 text-[48px] font-extrabold leading-none select-none tracking-[-0.04em]"
        style={{ color: "hsl(var(--border-light))" }}
      >
        {step}
      </div>
      <div className="relative rounded-xl overflow-hidden bg-[hsl(var(--surface-alt))] h-[180px] mb-4">
        {children}
      </div>
      <div className="text-base font-bold text-foreground mb-1.5 tracking-[-0.02em]">{title}</div>
      <div className="text-[13px] text-muted-foreground leading-[1.6]">{desc}</div>
    </div>
  );
}

// =============================================
// Scene 1 — Upload: файлы прилетают в drop-зону, URL печатается.
// Цикл: drag → drop → highlight → URL type → back to drag.
// =============================================
function UploadScene() {
  const [phase, setPhase] = useState(0);
  const [url, setUrl] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const loop = () => {
      clear();
      setUrl("");
      setPhase(0);
      // 0.8s — файлы влетают
      timers.current.push(window.setTimeout(() => setPhase(1), 800));
      // 1.8s — дроп-зона подсвечивается ✅
      timers.current.push(window.setTimeout(() => setPhase(2), 1800));
      // 2.8s — переходим к URL
      timers.current.push(window.setTimeout(() => setPhase(3), 2800));
      // 2.8–5s — печатаем URL посимвольно
      const URL_STR = "offi.ai";
      URL_STR.split("").forEach((_, i) => {
        timers.current.push(
          window.setTimeout(() => setUrl(URL_STR.slice(0, i + 1)), 2800 + (i + 1) * 110)
        );
      });
      // 5.5s — URL обрабатан ✅
      timers.current.push(window.setTimeout(() => setPhase(4), 5500));
      // 6.5s — рестарт
      timers.current.push(window.setTimeout(loop, 6500));
    };
    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    loop();
    return clear;
  }, []);

  const files = [
    { icon: FileText, color: "#ef4444", name: "Прайс.pdf" },
    { icon: FileSpreadsheet, color: "#059669", name: "Клиенты.xlsx" },
    { icon: FileText, color: "#2563eb", name: "Шаблон.docx" },
  ];

  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2">
      {/* Drop zone */}
      <div
        className={
          "relative flex-1 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-500 " +
          (phase === 1
            ? "border-primary bg-[hsl(var(--accent-brand-light))]"
            : phase === 2
            ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
            : "border-[hsl(var(--border))] bg-card/60")
        }
      >
        {/* Летящие файлы */}
        {files.map((f, i) => {
          const Icon = f.icon;
          const flying = phase === 0;
          const dropped = phase >= 1;
          return (
            <div
              key={i}
              className="absolute transition-all ease-out"
              style={{
                transitionDuration: "900ms",
                left: flying ? `${-10 + i * 20}%` : `${30 + i * 14}%`,
                top: flying ? `${-20 - i * 10}%` : "42%",
                transform: `rotate(${flying ? -6 + i * 4 : 0}deg) scale(${dropped ? 0.88 : 1})`,
                opacity: phase === 2 ? 0.5 : 1,
              }}
            >
              <div
                className="w-10 h-12 rounded-md shadow-md border border-border bg-card grid place-items-center"
                style={{ color: f.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}

        {/* Центральный лейбл */}
        <div className="relative z-[1] flex flex-col items-center gap-1 pointer-events-none">
          {phase === 2 ? (
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--success))] grid place-items-center text-white anim-scale-in">
              <Check className="w-4 h-4" />
            </div>
          ) : (
            <Upload className={"w-5 h-5 " + (phase === 1 ? "text-primary" : "text-[hsl(var(--text-tertiary))]")} />
          )}
          <span
            className={
              "text-[10px] font-semibold uppercase tracking-wider " +
              (phase === 1
                ? "text-primary"
                : phase === 2
                ? "text-[hsl(var(--success))]"
                : "text-[hsl(var(--text-tertiary))]")
            }
          >
            {phase === 2 ? "Загружено" : phase === 1 ? "Отпустите" : "Перетащите"}
          </span>
        </div>
      </div>

      {/* URL input */}
      <div
        className={
          "rounded-lg bg-card border flex items-center gap-2 px-2.5 h-9 transition-colors duration-300 " +
          (phase === 3 ? "border-primary" : phase === 4 ? "border-[hsl(var(--success))]" : "border-border")
        }
      >
        <Globe className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))] shrink-0" />
        <span className="text-[12px] flex-1 text-foreground">
          {url ? `https://${url}` : <span className="text-[hsl(var(--text-tertiary))]">или вставьте ссылку…</span>}
          {phase === 3 && url && <span className="inline-block w-[1.5px] h-[10px] bg-primary/70 ml-0.5 align-middle animate-pulse" />}
        </span>
        {phase === 4 && (
          <span className="w-5 h-5 rounded-full bg-[hsl(var(--success))] grid place-items-center text-white anim-scale-in">
            <Check className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================
// Scene 2 — Ask: пользователь печатает, AI начинает печатать в ответ.
// =============================================
function AskScene() {
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [showAi, setShowAi] = useState(false);
  const Q = "Напиши письмо клиенту";
  const A = "Собираю черновик…";

  useEffect(() => {
    const timers: number[] = [];
    const loop = () => {
      setUserText("");
      setAiText("");
      setShowAi(false);
      // Пользователь печатает
      Q.split("").forEach((_, i) => {
        timers.push(window.setTimeout(() => setUserText(Q.slice(0, i + 1)), 300 + i * 70));
      });
      // AI появляется и печатает
      const aiStart = 300 + Q.length * 70 + 500;
      timers.push(window.setTimeout(() => setShowAi(true), aiStart));
      A.split("").forEach((_, i) => {
        timers.push(window.setTimeout(() => setAiText(A.slice(0, i + 1)), aiStart + 600 + i * 50));
      });
      // Рестарт
      timers.push(window.setTimeout(loop, aiStart + 600 + A.length * 50 + 1600));
    };
    loop();
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <div className="absolute inset-0 p-3 flex flex-col justify-end gap-2">
      {/* User bubble */}
      <div className="flex gap-1.5 flex-row-reverse ml-auto max-w-[85%]">
        <div className="w-6 h-6 rounded-full bg-[hsl(var(--surface-alt))] border border-border grid place-items-center text-[9px] font-bold text-foreground shrink-0">
          Вы
        </div>
        <div className="px-2.5 py-1.5 rounded-[10px] rounded-tr-[3px] bg-card border border-border text-[12px] text-foreground min-h-[26px]">
          {userText || <span className="text-[hsl(var(--text-tertiary))]">…</span>}
          {userText.length < Q.length && userText && (
            <span className="inline-block w-[1.5px] h-[10px] bg-primary/70 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
      </div>

      {/* AI bubble */}
      {showAi && (
        <div className="flex gap-1.5 mr-auto max-w-[85%] anim-slide-right">
          <div className="w-6 h-6 rounded-full bg-[hsl(var(--accent-brand-light))] grid place-items-center shrink-0">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <div className="px-2.5 py-1.5 rounded-[10px] rounded-tl-[3px] bg-[hsl(var(--accent-brand-light))] text-[12px] text-foreground min-h-[26px]">
            {aiText ? (
              <>
                {aiText}
                {aiText.length < A.length && (
                  <span className="inline-block w-[1.5px] h-[10px] bg-primary/70 ml-0.5 align-middle animate-pulse" />
                )}
              </>
            ) : (
              <MiniTypingDots />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// Scene 3 — Done: появляется результат (письмо готово, отправлено).
// =============================================
function DoneScene() {
  const [phase, setPhase] = useState(0); // 0=idle, 1=card, 2=sending, 3=sent

  useEffect(() => {
    const timers: number[] = [];
    const loop = () => {
      setPhase(0);
      timers.push(window.setTimeout(() => setPhase(1), 600));
      timers.push(window.setTimeout(() => setPhase(2), 2000));
      timers.push(window.setTimeout(() => setPhase(3), 3200));
      timers.push(window.setTimeout(loop, 4900));
    };
    loop();
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <div className="absolute inset-0 p-3 flex items-center justify-center">
      {phase >= 1 && (
        <div
          className={
            "w-full max-w-[220px] rounded-xl border bg-card overflow-hidden anim-scale-in transition-colors duration-500 " +
            (phase >= 3 ? "border-[hsl(var(--success))]" : "border-border")
          }
        >
          <div className="px-3 py-1.5 bg-[hsl(var(--surface-alt))] border-b border-[hsl(var(--border-light))] text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Письмо клиенту</span>
            {phase === 2 && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Mail className="w-3 h-3" />
                <MiniTypingDots />
              </span>
            )}
            {phase === 3 && (
              <span className="inline-flex items-center gap-1 text-[hsl(var(--success))] font-semibold">
                <Check className="w-3 h-3" />
                Отправлено
              </span>
            )}
          </div>
          <div className="p-3 space-y-1.5">
            <div className="h-2 rounded bg-[hsl(var(--surface-alt))] w-[90%]" />
            <div className="h-2 rounded bg-[hsl(var(--surface-alt))] w-[70%]" />
            <div className="h-2 rounded bg-[hsl(var(--surface-alt))] w-[82%]" />
            <div className="flex items-center gap-2 pt-2">
              <div className="w-6 h-7 rounded bg-[hsl(var(--accent-brand-light))] text-primary grid place-items-center">
                <FileDown className="w-3 h-3" />
              </div>
              <span className="text-[10px] text-muted-foreground">договор-48.docx</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniTypingDots() {
  return (
    <span className="inline-flex gap-[3px] items-center align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-primary"
          style={{ animation: `dot-bounce 1.2s ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}
