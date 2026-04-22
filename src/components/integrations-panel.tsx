"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  MessageCircle,
  Briefcase,
  Zap,
  ChevronDown,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useBranding } from "@/components/branding-provider";
import { createClient } from "@/lib/supabase/client";

export type Integration = { id: string; type: string; enabled: boolean; config: any };

type FieldType = "text" | "password" | "email";

type IntegrationSpec = {
  key: string;
  label: string;
  hint: string;
  icon: any;
  fields: Array<{ key: string; label: string; type: FieldType; placeholder?: string; required?: boolean }>;
};

const SPECS: IntegrationSpec[] = [
  {
    key: "email",
    label: "Email (Postmark)",
    hint: "Отправка писем клиентам от имени сотрудника",
    icon: Mail,
    fields: [
      { key: "server_token", label: "Server Token", type: "password", required: true },
      { key: "from_email", label: "Email отправителя", type: "email", placeholder: "hello@company.ru", required: true },
      { key: "from_name", label: "Имя отправителя", type: "text", placeholder: "Компания" },
    ],
  },
  {
    key: "telegram",
    label: "Telegram",
    hint: "Бот для сообщений и уведомлений",
    icon: MessageCircle,
    fields: [
      { key: "bot_token", label: "Bot Token", type: "password", required: true },
      { key: "default_chat_id", label: "Default Chat ID", type: "text", placeholder: "-1001234567890" },
    ],
  },
  {
    key: "amocrm",
    label: "AmoCRM",
    hint: "Синхронизация сделок и контактов",
    icon: Briefcase,
    fields: [
      { key: "domain", label: "Domain", type: "text", placeholder: "company.amocrm.ru", required: true },
      { key: "long_lived_token", label: "Long-lived Token", type: "password", required: true },
    ],
  },
  {
    key: "bitrix24",
    label: "Bitrix24",
    hint: "Синхронизация сделок и контактов",
    icon: Briefcase,
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "text", placeholder: "https://company.bitrix24.ru/rest/1/…/", required: true },
    ],
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    hint: "Создание и просмотр встреч",
    icon: Zap,
    fields: [
      { key: "service_account_email", label: "Service Account Email", type: "email", required: true },
      { key: "service_account_key", label: "Private Key (JSON)", type: "password", required: true },
    ],
  },
];

export function IntegrationsPanel({
  initialIntegrations,
  canEdit,
}: {
  initialIntegrations: Integration[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const brand = useBranding();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const byType = useMemo(
    () => new Map(initialIntegrations.map((i) => [i.type, i])),
    [initialIntegrations]
  );

  return (
    <section className="card-surface p-5">
      <h2 className="font-semibold">Интеграции</h2>
      <p className="text-sm text-muted-foreground">
        Подключите каналы коммуникации и CRM. MVP: сохранение конфигурации + проверка соединения.
      </p>

      <div className="mt-4 space-y-2">
        {SPECS.map((spec) => {
          const existing = byType.get(spec.key);
          const open = openKey === spec.key;
          return (
            <IntegrationRow
              key={spec.key}
              spec={spec}
              existing={existing}
              open={open}
              accent={brand.accentColor}
              canEdit={canEdit}
              onToggleOpen={() => setOpenKey(open ? null : spec.key)}
              onSaved={() => router.refresh()}
            />
          );
        })}
      </div>
    </section>
  );
}

function IntegrationRow({
  spec,
  existing,
  open,
  accent,
  canEdit,
  onToggleOpen,
  onSaved,
}: {
  spec: IntegrationSpec;
  existing: Integration | undefined;
  open: boolean;
  accent: string;
  canEdit: boolean;
  onToggleOpen: () => void;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(!!existing?.enabled);
  const [config, setConfig] = useState<Record<string, string>>(existing?.config ?? {});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      if (existing) {
        await supabase.from("integrations").update({ enabled, config }).eq("id", existing.id);
      } else {
        await supabase.from("integrations").insert({ type: spec.key, enabled, config });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: spec.key, config }),
      });
      const j = await res.json().catch(() => ({}));
      setTestResult({ ok: res.ok && j.ok === true, detail: j.detail ?? j.error });
    } catch (e) {
      setTestResult({ ok: false, detail: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const filled = spec.fields.filter((f) => f.required).every((f) => (config[f.key] ?? "").trim() !== "");

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition"
      >
        <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center">
          <spec.icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{spec.label}</div>
          <div className="text-xs text-muted-foreground">{spec.hint}</div>
        </div>
        {enabled && (
          <span
            className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              color: accent,
            }}
          >
            Включено
          </span>
        )}
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/60">
          <div className="pt-3 grid md:grid-cols-2 gap-3">
            {spec.fields.map((f) => {
              const isPassword = f.type === "password";
              const shown = reveal[f.key];
              return (
                <div key={f.key} className="space-y-1">
                  <Label>
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type={isPassword && !shown ? "password" : "text"}
                      value={config[f.key] ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      disabled={!canEdit}
                      className={cn(isPassword && "pr-10")}
                    />
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() => setReveal((r) => ({ ...r, [f.key]: !shown }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-muted-foreground"
                      >
                        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {testResult && (
            <div
              className={cn(
                "text-sm rounded-lg px-3 py-2 flex items-center gap-2",
                testResult.ok ? "bg-[#059669]/10 text-[#047857]" : "bg-destructive/10 text-destructive"
              )}
            >
              {testResult.ok ? <Check className="w-4 h-4" /> : <span>⚠️</span>}
              {testResult.ok ? "Соединение работает" : testResult.detail ?? "Не удалось подключиться"}
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!canEdit || !filled}
                className="w-4 h-4"
              />
              Включено
            </label>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={test}
                disabled={testing || !filled}
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Тест
              </Button>
              <Button
                onClick={save}
                disabled={!canEdit || busy}
                style={{ background: accent }}
              >
                {busy ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
