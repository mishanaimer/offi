"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MascotAvatar } from "@/components/mascot";
import {
  HEAD_SHAPES,
  ANTENNA_STYLES,
  EAR_STYLES,
  HEAD_SHAPE_LABELS,
  ANTENNA_LABELS,
  EAR_LABELS,
  type HeadShape,
  type AntennaStyle,
  type EarStyle,
} from "@/components/mascot";
import { SettingsTabs } from "@/components/settings-tabs";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { suggestAssistantName } from "@/lib/assistant-name";
import { tintFromHex } from "@/lib/mascot/generate";
import { Upload, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Company = {
  id: string;
  name: string;
  assistant_name: string;
  brand_accent: string | null;
  assistant_color: string | null;
  assistant_icon: string | null;
  welcome_message: string | null;
  logo_url: string | null;
  plan: string;
  mascot_enabled?: boolean | null;
  mascot_head_shape?: string | null;
  mascot_antenna?: string | null;
  mascot_ears?: string | null;
  mascot_bg?: string | null;
};
type Integration = { id: string; type: string; enabled: boolean; config: any };

const PRESETS = [
  "#1a6eff", // Offi blue
  "#0259DD",
  "#00A082", // mint
  "#7C3AED", // violet
  "#E11D48", // rose
  "#F59E0B", // amber
  "#111827", // graphite
  "#0EA5E9", // sky
];

const BG_PRESETS = [
  "#EEF4FF",
  "#ECFDF5",
  "#FFFAEB",
  "#F5F0FF",
  "#FFF0F0",
  "#ECFEFF",
  "#F8FAFC",
];

export function SettingsView({
  company,
  integrations,
  currentUserRole,
}: {
  company: Company;
  integrations: Integration[];
  currentUserRole: "owner" | "admin" | "member";
}) {
  const router = useRouter();
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  const [name, setName] = useState(company.name);
  const [assistantName, setAssistantName] = useState(company.assistant_name);
  const [accent, setAccent] = useState(company.brand_accent ?? "#1a6eff");
  const [assistantColor, setAssistantColor] = useState(
    company.assistant_color ?? company.brand_accent ?? "#1a6eff"
  );
  const [assistantIcon, setAssistantIcon] = useState(company.assistant_icon ?? "sparkles");
  const [welcomeMessage, setWelcomeMessage] = useState(
    company.welcome_message ?? `Привет! Я ${company.assistant_name}. Спросите что-нибудь.`
  );
  const [mascotHead, setMascotHead] = useState<HeadShape>(
    (company.mascot_head_shape as HeadShape) ?? "classic"
  );
  const [mascotAntenna, setMascotAntenna] = useState<AntennaStyle>(
    (company.mascot_antenna as AntennaStyle) ?? "ball"
  );
  const [mascotEars, setMascotEars] = useState<EarStyle>(
    (company.mascot_ears as EarStyle) ?? "round"
  );
  const [mascotBg, setMascotBg] = useState<string>(
    company.mascot_bg ?? tintFromHex(company.assistant_color ?? company.brand_accent ?? "#1a6eff")
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(company.logo_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestedAssistant = useMemo(() => suggestAssistantName(name), [name]);

  async function save() {
    if (!isAdmin) return;
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("companies")
      .update({
        name,
        assistant_name: assistantName,
        brand_accent: accent,
        assistant_color: assistantColor,
        assistant_icon: assistantIcon,
        welcome_message: welcomeMessage,
        logo_url: logoUrl,
        mascot_head_shape: mascotHead,
        mascot_antenna: mascotAntenna,
        mascot_ears: mascotEars,
        mascot_bg: mascotBg,
      })
      .eq("id", company.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  }

  async function uploadLogo(file: File) {
    if (!isAdmin) return;
    setUploading(true);
    setErr(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const path = `logos/${company.id}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      setLogoUrl(url);
    } catch (e: any) {
      setErr(e.message ?? "Не удалось загрузить логотип");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <header
        className="h-16 sticky top-0 z-10 glass border-b border-border/60 px-4 md:px-6 flex items-center"
        style={{ backdropFilter: "saturate(180%) blur(20px)" }}
      >
        <h1 className="text-lg font-semibold">Настройки</h1>
        {!isAdmin && (
          <span className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> только просмотр
          </span>
        )}
      </header>
      <SettingsTabs />

      <div className="container-page max-w-3xl py-6 md:py-10 space-y-6">
        {/* Brand */}
        <section className="card-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-base">Бренд</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Цвета, имя ассистента и логотип, которые видят сотрудники в приложении.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {/* Company name */}
            <div className="space-y-1.5">
              <Label>Название компании</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            {/* Logo */}
            <div className="space-y-1.5">
              <Label>Логотип</Label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="logo"
                    className="w-14 h-14 rounded-xl object-cover border border-border"
                  />
                ) : (
                  <span
                    className="w-14 h-14 rounded-xl grid place-items-center text-white text-xl font-semibold"
                    style={{ background: accent }}
                  >
                    {(name.trim()[0] ?? "O").toUpperCase()}
                  </span>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={!isAdmin || uploading}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {uploading ? "Загружаем…" : "Загрузить"}
                  </Button>
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      onClick={() => setLogoUrl(null)}
                      disabled={!isAdmin}
                    >
                      Убрать
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG/SVG, квадрат, до 1 МБ.</p>
            </div>

            {/* Accent */}
            <div className="space-y-1.5">
              <Label>Акцентный цвет</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setAccent(c)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition",
                      accent.toLowerCase() === c.toLowerCase()
                        ? "border-foreground"
                        : "border-transparent"
                    )}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  disabled={!isAdmin}
                  className="w-8 h-8 rounded-full border border-border cursor-pointer"
                />
                <Input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  disabled={!isAdmin}
                  className="flex-1 min-w-[120px]"
                />
              </div>
            </div>

            {/* Assistant */}
            <div className="rounded-2xl border border-border p-4 space-y-4">
              <div
                className="rounded-2xl p-5 flex items-center gap-4 transition"
                style={{ background: mascotBg }}
              >
                <MascotAvatar
                  size={84}
                  animated
                  listenOneshots={false}
                  override={{
                    color: assistantColor,
                    bg: mascotBg,
                    headShape: mascotHead,
                    antenna: mascotAntenna,
                    ears: mascotEars,
                  }}
                />
                <div>
                  <div
                    className="text-[10px] tracking-[0.15em] uppercase font-semibold opacity-60"
                    style={{ color: assistantColor }}
                  >
                    {name || "Бренд"}
                  </div>
                  <div className="text-[22px] font-bold leading-tight" style={{ color: assistantColor }}>
                    {assistantName || "Ассистент"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Живой маскот вашего бренда
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Имя ассистента</Label>
                  <Input
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    placeholder={suggestedAssistant}
                    disabled={!isAdmin}
                  />
                  {isAdmin && suggestedAssistant !== assistantName && (
                    <button
                      type="button"
                      onClick={() => setAssistantName(suggestedAssistant)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Использовать «{suggestedAssistant}»
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Цвет маскота</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={assistantColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAssistantColor(v);
                        if (mascotBg.toLowerCase() === tintFromHex(assistantColor).toLowerCase()) {
                          setMascotBg(tintFromHex(v));
                        }
                      }}
                      disabled={!isAdmin}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <Input
                      value={assistantColor}
                      onChange={(e) => setAssistantColor(e.target.value)}
                      disabled={!isAdmin}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <MascotChipRow
                label="Форма головы"
                items={HEAD_SHAPES}
                labels={HEAD_SHAPE_LABELS}
                value={mascotHead}
                onChange={setMascotHead}
                disabled={!isAdmin}
                accent={assistantColor}
              />
              <MascotChipRow
                label="Антенна"
                items={ANTENNA_STYLES}
                labels={ANTENNA_LABELS}
                value={mascotAntenna}
                onChange={setMascotAntenna}
                disabled={!isAdmin}
                accent={assistantColor}
              />
              <MascotChipRow
                label="Уши"
                items={EAR_STYLES}
                labels={EAR_LABELS}
                value={mascotEars}
                onChange={setMascotEars}
                disabled={!isAdmin}
                accent={assistantColor}
              />

              <div className="space-y-1.5">
                <Label>Фон маскота</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {BG_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setMascotBg(c)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition",
                        mascotBg.toLowerCase() === c.toLowerCase()
                          ? "border-foreground"
                          : "border-border"
                      )}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={mascotBg}
                    onChange={(e) => setMascotBg(e.target.value)}
                    disabled={!isAdmin}
                    className="w-8 h-8 rounded-full border border-border cursor-pointer"
                  />
                  <Input
                    value={mascotBg}
                    onChange={(e) => setMascotBg(e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 min-w-[120px]"
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setMascotBg(tintFromHex(assistantColor))}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 h-8 text-xs hover:bg-muted transition"
                      title="Собрать фон из цвета маскота"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Авто
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Приветственное сообщение</Label>
                <Textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={3}
                  className="min-h-[84px]"
                  disabled={!isAdmin}
                />
              </div>

              {/* Слот под будущий мастер создания ассистента */}
              <div className="rounded-xl border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
                Скоро: мастер создания ассистента — описание роли, стиль ответов, тон общения.
              </div>
            </div>

            {err && <p className="text-sm text-destructive">{err}</p>}

            {isAdmin && (
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Сохраняем…" : "Сохранить"}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* integrations */}
        <IntegrationsPanel initialIntegrations={integrations} canEdit={isAdmin} />

      </div>
    </div>
  );
}

function MascotChipRow<T extends string>({
  label,
  items,
  labels,
  value,
  onChange,
  disabled,
  accent,
}: {
  label: string;
  items: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  accent: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const active = value === it;
          return (
            <button
              key={it}
              type="button"
              disabled={disabled}
              onClick={() => onChange(it)}
              className={cn(
                "inline-flex items-center rounded-full border px-3.5 h-9 text-[13px] font-medium transition",
                active
                  ? "border-transparent text-white"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              style={active ? { background: accent } : undefined}
            >
              {labels[it]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
