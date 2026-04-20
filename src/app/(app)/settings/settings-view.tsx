"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Mail, MessageCircle, Briefcase, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string; assistant_name: string; brand_accent: string | null; plan: string };
type Member = { id: string; email: string; full_name: string | null; role: string };
type Integration = { id: string; type: string; enabled: boolean; config: any };

const INTEGRATION_META: Record<string, { label: string; icon: any; hint: string }> = {
  email: { label: "Email (Postmark)", icon: Mail, hint: "Отправка писем клиентам от имени сотрудника" },
  telegram: { label: "Telegram", icon: MessageCircle, hint: "Бот для сообщений и уведомлений" },
  amocrm: { label: "AmoCRM", icon: Briefcase, hint: "Синхронизация сделок и контактов" },
  bitrix24: { label: "Bitrix24", icon: Briefcase, hint: "Синхронизация сделок и контактов" },
  google_calendar: { label: "Google Calendar", icon: Zap, hint: "Создание и просмотр встреч" },
};

export function SettingsView({ company, members, integrations }: { company: Company; members: Member[]; integrations: Integration[] }) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [assistantName, setAssistantName] = useState(company.assistant_name);
  const [accent, setAccent] = useState(company.brand_accent ?? "#1a6eff");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("companies").update({ name, assistant_name: assistantName, brand_accent: accent }).eq("id", company.id);
    setSaving(false);
    router.refresh();
  }

  const integrationsMap = new Map(integrations.map((i) => [i.type, i]));

  async function toggleIntegration(type: string, enabled: boolean) {
    const supabase = createClient();
    const existing = integrationsMap.get(type);
    if (existing) {
      await supabase.from("integrations").update({ enabled }).eq("id", existing.id);
    } else {
      await supabase.from("integrations").insert({ type, enabled, config: {} });
    }
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center">
        <h1 className="text-lg font-semibold">Настройки</h1>
      </header>

      <div className="container-page max-w-3xl py-6 md:py-10 space-y-6">
        {/* company */}
        <section className="card-surface p-6">
          <h2 className="font-semibold">Компания и ассистент</h2>
          <p className="text-sm text-muted-foreground">Имя ассистента видят сотрудники в чате и на лендинге.</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Название компании</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Имя ассистента</Label>
              <Input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Акцент бренда</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-11 h-11 rounded-xl border border-border cursor-pointer" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
            </div>
          </div>
        </section>

        {/* integrations */}
        <section className="card-surface p-6">
          <h2 className="font-semibold">Интеграции</h2>
          <p className="text-sm text-muted-foreground">Подключите каналы коммуникации и CRM.</p>
          <div className="mt-4 space-y-2">
            {Object.entries(INTEGRATION_META).map(([type, meta]) => {
              const I = integrationsMap.get(type);
              const enabled = !!I?.enabled;
              return (
                <div key={type} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center">
                    <meta.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.hint}</div>
                  </div>
                  <button
                    onClick={() => toggleIntegration(type, !enabled)}
                    className={cn("h-6 w-11 rounded-full transition relative", enabled ? "bg-primary" : "bg-muted")}
                    aria-label="toggle"
                  >
                    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", enabled ? "left-5" : "left-0.5")} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* members */}
        <section className="card-surface p-6">
          <h2 className="font-semibold">Сотрудники ({members.length})</h2>
          <div className="mt-4 divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">
                  {(m.full_name ?? m.email)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.full_name ?? m.email}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <span className="text-xs text-muted-foreground">{m.role}</span>
                {m.role === "owner" && <Check className="w-4 h-4 text-primary" />}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Приглашение сотрудников появится в ближайшем обновлении.
          </p>
        </section>

        {/* plan */}
        <section className="card-surface p-6">
          <h2 className="font-semibold">Тариф</h2>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-sm">Текущий: <span className="font-medium capitalize">{company.plan}</span></div>
              <div className="text-xs text-muted-foreground">Обновление тарифов и биллинг — на этапе пилота по запросу.</div>
            </div>
            <a href="mailto:hello@offi.ai"><Button variant="outline">Сменить</Button></a>
          </div>
        </section>
      </div>
    </div>
  );
}
