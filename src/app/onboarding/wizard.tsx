"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestAssistantName } from "@/lib/assistant-name";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, FileText, Globe, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuestMascot, MascotLoader, useMascotEmotions } from "@/components/mascot";

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({ userEmail, userId }: { userEmail: string; userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<"url" | "text" | "skip">("text");
  const [knowledgeValue, setKnowledgeValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const mascot = useMascotEmotions("idle");

  const suggestedName = useMemo(() => suggestAssistantName(companyName), [companyName]);

  // Каждый шаг — своя микро-эмоция. Не агрессивно, а в тему контекста.
  useEffect(() => {
    if (step === 1) mascot.fire("wink");
    if (step === 2) mascot.fire("love");
    if (step === 3) mascot.fire("pensive");
    if (step === 4) mascot.fire("joy");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (err) mascot.fire("surprise");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err]);

  async function finish() {
    setErr(null);
    mascot.setState("working");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          assistantName: assistantName || suggestedName,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { companyId } = (await res.json()) as { companyId: string };

      if (knowledgeMode !== "skip" && knowledgeValue.trim()) {
        await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            source: knowledgeMode,
            value: knowledgeValue,
          }),
        });
      }

      mascot.fire("joy");
      startTransition(() => {
        router.push("/chat");
        router.refresh();
      });
    } catch (e) {
      mascot.setState("idle");
      setErr((e as Error).message);
    }
  }

  // Во время финальной подготовки показываем полноэкранный лоадер с маскотом.
  if (pending) {
    return (
      <div className="w-full max-w-xl flex flex-col items-center gap-6 animate-fade-in">
        <MascotLoader
          size={140}
          state="working"
          label="Готовим ваше рабочее место…"
        />
        <div className="text-center space-y-1 text-sm text-muted-foreground">
          <div>Создаём компанию «{companyName}»</div>
          <div>Настраиваем ассистента «{assistantName || suggestedName}»</div>
          {knowledgeMode !== "skip" && knowledgeValue.trim() && (
            <div>Учим ассистента на вашей базе знаний</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl animate-fade-in">
      {/* Маскот над прогрессом — живёт вместе со всеми шагами */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-full anim-halo pointer-events-none"
            style={{
              background: "radial-gradient(closest-side, hsl(var(--accent-brand-light)), transparent 70%)",
            }}
            aria-hidden
          />
          <GuestMascot
            size={72}
            state={mascot.props.state}
            oneshotId={mascot.props.oneshotId}
            oneshotKey={mascot.props.oneshotKey}
            animated
          />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-[-0.01em]">
            {step === 1 && "Шаг 1 из 4 — Знакомимся"}
            {step === 2 && "Шаг 2 из 4 — Имя помощника"}
            {step === 3 && "Шаг 3 из 4 — База знаний"}
            {step === 4 && "Шаг 4 из 4 — Всё готово"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {step === 1 && "Расскажите немного о компании."}
            {step === 2 && "Можно переименовать ассистента или оставить наш вариант."}
            {step === 3 && "Пара абзацев — и он уже знает бизнес."}
            {step === 4 && "Подтвердите — и переходим в чат."}
          </div>
        </div>
      </div>

      <Progress step={step} />
      <div className="mt-8 card-surface p-6 md:p-8">
        {step === 1 && (
          <Section
            title="Как называется ваша компания?"
            hint={`Например: «ДентОпт», «АйСистемс». Это повлияет на имя ассистента.`}
          >
            <Input
              autoFocus
              placeholder="Название компании"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onFocus={() => mascot.fire("pensive")}
            />
            <p className="text-xs text-muted-foreground">Вошли как {userEmail}</p>
            <Next disabled={!companyName.trim()} onClick={() => { setAssistantName(suggestedName); setStep(2); }} />
          </Section>
        )}

        {step === 2 && (
          <Section
            title="Как назовём вашего ассистента?"
            hint={`Мы предложили «${suggestedName}» — можно оставить или изменить. По умолчанию «Оффи».`}
          >
            <div className="flex gap-2">
              <Input
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                onFocus={() => mascot.fire("wink")}
              />
              <Button variant="outline" onClick={() => { setAssistantName(suggestedName); mascot.fire("love"); }}>
                {suggestedName}
              </Button>
              <Button variant="ghost" onClick={() => { setAssistantName("Оффи"); mascot.fire("joy"); }}>
                Оффи
              </Button>
            </div>
            <Next onClick={() => setStep(3)} disabled={!assistantName.trim()} />
          </Section>
        )}

        {step === 3 && (
          <Section
            title="Чему научим ассистента?"
            hint="Загрузку файлов можно сделать потом. Для быстрого старта — вставьте URL сайта или текст."
          >
            <div className="grid sm:grid-cols-3 gap-2">
              <ModeButton icon={Globe} active={knowledgeMode === "url"} onClick={() => { setKnowledgeMode("url"); mascot.fire("surprise"); }}>URL сайта</ModeButton>
              <ModeButton icon={FileText} active={knowledgeMode === "text"} onClick={() => { setKnowledgeMode("text"); mascot.fire("pensive"); }}>Свой текст</ModeButton>
              <ModeButton icon={Sparkles} active={knowledgeMode === "skip"} onClick={() => { setKnowledgeMode("skip"); mascot.fire("sleepy"); }}>Пропустить</ModeButton>
            </div>
            {knowledgeMode === "url" && (
              <Input
                placeholder="https://вашсайт.ru"
                value={knowledgeValue}
                onChange={(e) => setKnowledgeValue(e.target.value)}
                className="mt-3"
              />
            )}
            {knowledgeMode === "text" && (
              <Textarea
                placeholder="Опишите бизнес в 3–5 абзацах: что делаете, для кого, какие услуги, цены, условия…"
                value={knowledgeValue}
                onChange={(e) => setKnowledgeValue(e.target.value)}
                className="mt-3 min-h-[140px]"
              />
            )}
            {knowledgeMode === "skip" && (
              <p className="mt-3 text-sm text-muted-foreground">
                Добавите документы позже в разделе «База знаний».
              </p>
            )}
            <Next onClick={() => setStep(4)} />
          </Section>
        )}

        {step === 4 && (
          <Section title="Всё готово!" hint="Сейчас мы подготовим ваше рабочее место.">
            <div className="space-y-2 text-sm">
              <Row label="Компания">{companyName}</Row>
              <Row label="Ассистент">{assistantName}</Row>
              <Row label="База знаний">{knowledgeMode === "skip" ? "Пропущена" : knowledgeMode === "url" ? "URL" : "Свой текст"}</Row>
            </div>
            {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)}>Назад</Button>
              <Button onClick={finish} disabled={pending} className="flex-1">
                Начать пользоваться
              </Button>
            </div>
          </Section>
        )}
      </div>
      {/* userId используется upstream для аналитики; оставим как hidden-анкор. */}
      <input type="hidden" value={userId} readOnly />
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={cn(
            "h-1.5 flex-1 rounded-full bg-muted transition-all duration-500",
            step >= n && "bg-primary"
          )}
          style={{
            transform: step === n ? "scaleY(1.3)" : "scaleY(1)",
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {hint && <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Next({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button onClick={onClick} disabled={disabled} className="w-full mt-2">
      Далее <ArrowRight className="w-4 h-4" />
    </Button>
  );
}

function ModeButton({ icon: Icon, active, children, onClick }: { icon: React.ElementType; active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm transition-all",
        active && "border-primary ring-2 ring-primary/15"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
      {active && <Check className="w-4 h-4 text-primary ml-auto" />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
