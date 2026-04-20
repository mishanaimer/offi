"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestAssistantName } from "@/lib/assistant-name";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, FileText, Globe, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const suggestedName = useMemo(() => suggestAssistantName(companyName), [companyName]);

  async function finish() {
    setErr(null);
    try {
      const supabase = createClient();

      // 1) создаём компанию
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({ name: companyName, assistant_name: assistantName || suggestedName })
        .select()
        .single();
      if (companyErr) throw companyErr;

      // 2) привязываем пользователя
      const { error: linkErr } = await supabase
        .from("users")
        .update({ company_id: company.id })
        .eq("id", userId);
      if (linkErr) throw linkErr;

      // 3) стартовый канал
      await supabase
        .from("channels")
        .insert({ company_id: company.id, name: "Основной чат", type: "ai", created_by: userId });

      // 4) импорт начальной базы знаний (если указали)
      if (knowledgeMode !== "skip" && knowledgeValue.trim()) {
        await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            source: knowledgeMode,         // "url" | "text"
            value: knowledgeValue,
          }),
        });
      }

      startTransition(() => {
        router.push("/chat");
        router.refresh();
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="w-full max-w-xl animate-fade-in">
      <Progress step={step} />
      <div className="mt-8 card-surface p-6 md:p-8">
        {step === 1 && (
          <Section
            title="Как называется ваша компания?"
            hint={`Например: «ДентОпт», «АйСистемс». Это повлияет на имя ассистента. ${userEmail}`}
          >
            <Input
              autoFocus
              placeholder="Название компании"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Next disabled={!companyName.trim()} onClick={() => { setAssistantName(suggestedName); setStep(2); }} />
          </Section>
        )}

        {step === 2 && (
          <Section
            title="Как назовём вашего ассистента?"
            hint={`Мы предложили «${suggestedName}» — можно оставить или изменить. По умолчанию «Оффи».`}
          >
            <div className="flex gap-2">
              <Input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
              <Button variant="outline" onClick={() => setAssistantName(suggestedName)}>{suggestedName}</Button>
              <Button variant="ghost" onClick={() => setAssistantName("Оффи")}>Оффи</Button>
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
              <ModeButton icon={Globe} active={knowledgeMode === "url"} onClick={() => setKnowledgeMode("url")}>URL сайта</ModeButton>
              <ModeButton icon={FileText} active={knowledgeMode === "text"} onClick={() => setKnowledgeMode("text")}>Свой текст</ModeButton>
              <ModeButton icon={Sparkles} active={knowledgeMode === "skip"} onClick={() => setKnowledgeMode("skip")}>Пропустить</ModeButton>
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
                {pending ? "Готовим…" : "Начать пользоваться"}
              </Button>
            </div>
          </Section>
        )}
      </div>
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
            "h-1.5 flex-1 rounded-full bg-muted transition",
            step >= n && "bg-primary"
          )}
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
