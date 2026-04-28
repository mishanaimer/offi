"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Download, FileText, Sparkles, Wand2, X } from "lucide-react";

type TemplateMeta = { id: string; name: string; description: string };
type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "textarea";
  hint?: string;
  required?: boolean;
};

type GenerateResp = {
  warnings: string[];
  replacementsApplied: number;
  docxBase64: string;
  htmlPreview: string;
  suggestedName: string;
};

const FIELD_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Договор",
    keys: [
      "contract_number",
      "contract_day",
      "contract_month",
      "contract_year",
      "act_date_short",
      "act_day_padded",
      "act_city",
      "service_start_date",
    ],
  },
  {
    title: "Абонент — основные данные",
    keys: [
      "client_full_name",
      "client_short_name",
      "client_signatory_clause",
      "client_signatory_short",
      "client_signatory_title",
      "client_legal_address",
      "client_actual_address",
    ],
  },
  {
    title: "Банковские и налоговые реквизиты",
    keys: [
      "client_inn",
      "client_kpp",
      "client_ogrn",
      "client_bank",
      "client_account",
      "client_corr_account",
      "client_bik",
      "client_email",
    ],
  },
  {
    title: "Спецификация и точка подключения",
    keys: [
      "spec_contact_name",
      "spec_contact_phone",
      "spec_contact_email",
      "service_address",
      "service_address_short",
    ],
  },
];

export function ContractGeneratorView() {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [data, setData] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState("");
  const [parseStatus, setParseStatus] = useState<{ msg: string; tone: "ok" | "warn" | "err" } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResp | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Load templates list once
  useEffect(() => {
    fetch("/api/documents/templates")
      .then((r) => r.json())
      .then((j: { templates: TemplateMeta[] }) => {
        setTemplates(j.templates);
        if (j.templates.length && !selectedId) setSelectedId(j.templates[0].id);
      })
      .catch(() => setTemplates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load fields when template changes; restore from localStorage
  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/documents/template/${selectedId}`)
      .then((r) => r.json())
      .then((j: { fields: FieldDef[] }) => {
        setFields(j.fields);
        const saved = loadDraft(selectedId);
        const initial: Record<string, string> = {};
        for (const f of j.fields) initial[f.key] = saved[f.key] ?? "";
        setData(initial);
      });
  }, [selectedId]);

  // Persist on change
  useEffect(() => {
    if (!selectedId) return;
    saveDraft(selectedId, data);
  }, [selectedId, data]);

  const fieldsByKey = useMemo(() => {
    const m: Record<string, FieldDef> = {};
    for (const f of fields) m[f.key] = f;
    return m;
  }, [fields]);

  async function handleParse() {
    const text = pasteText.trim();
    if (!text) {
      setParseStatus({ msg: "Сначала вставь текст", tone: "warn" });
      return;
    }
    setParseStatus({ msg: "Распознаю…", tone: "ok" });
    try {
      const r = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const parsed = (await r.json()) as Record<string, string>;
      let filled = 0;
      const next = { ...data };
      for (const k of Object.keys(parsed)) {
        if (k in fieldsByKey) {
          next[k] = parsed[k];
          filled++;
        }
      }
      setData(next);
      setParseStatus({ msg: `✓ Заполнено полей: ${filled}`, tone: "ok" });
    } catch (e) {
      setParseStatus({ msg: "Ошибка: " + (e as Error).message, tone: "err" });
    }
  }

  async function handleGenerate() {
    if (!selectedId) return;
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      const r = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedId, data }),
      });
      if (!r.ok) {
        const errText = await r.text();
        throw new Error(errText || "Ошибка генерации");
      }
      const result = (await r.json()) as GenerateResp;
      setGenResult(result);
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!genResult) return;
    const bytes = base64ToBytes(genResult.docxBase64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = genResult.suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] flex-1 overflow-hidden">
      {/* templates list */}
      <aside className="border-r border-border/60 overflow-y-auto md:min-h-0">
        <div className="p-3 space-y-1">
          {templates.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Загружаю шаблоны…</div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 flex items-start gap-2 transition ${
                  selectedId === t.id ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="overflow-y-auto">
        <div className="container-page max-w-3xl py-6 space-y-5">
          {!selectedId ? (
            <div className="text-sm text-muted-foreground">Выберите шаблон слева.</div>
          ) : (
            <>
              {/* Paste area */}
              <div className="card-surface p-5 space-y-3">
                <div className="font-medium flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" /> Распознать реквизиты из текста
                </div>
                <p className="text-xs text-muted-foreground">
                  Вставь карточку контрагента — ИНН, КПП, ОГРН, счета, банк, адреса и подписант
                  заполнятся сами.
                </p>
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"ООО «АЛОЭ»\nИНН 7814293260, КПП 781401001, ОГРН 1157847365015\nр/с 40702810055070003990 в ПАО Сбербанк\nк/с 30101810500000000653, БИК 044030653\nЮридический адрес: 197375, г. Санкт-Петербург, …"}
                  className="min-h-[140px] font-mono text-xs"
                />
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={handleParse}>
                    <Sparkles className="w-4 h-4" /> Распознать и заполнить
                  </Button>
                  {parseStatus && (
                    <span
                      className={`text-xs ${
                        parseStatus.tone === "err"
                          ? "text-destructive"
                          : parseStatus.tone === "warn"
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {parseStatus.msg}
                    </span>
                  )}
                </div>
              </div>

              {/* Fields by group */}
              {FIELD_GROUPS.map((group) => {
                const visibleKeys = group.keys.filter((k) => fieldsByKey[k]);
                if (visibleKeys.length === 0) return null;
                return (
                  <div key={group.title} className="card-surface p-5 space-y-4">
                    <div className="text-sm font-medium">{group.title}</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {visibleKeys.map((key) => {
                        const f = fieldsByKey[key];
                        const isTextarea = f.type === "textarea";
                        return (
                          <div
                            key={key}
                            className={`space-y-1.5 ${isTextarea ? "sm:col-span-2" : ""}`}
                          >
                            <label htmlFor={`f_${key}`} className="text-xs text-muted-foreground">
                              {f.label}
                            </label>
                            {isTextarea ? (
                              <Textarea
                                id={`f_${key}`}
                                value={data[key] ?? ""}
                                onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                                placeholder={f.placeholder}
                                className="min-h-[72px]"
                              />
                            ) : (
                              <Input
                                id={`f_${key}`}
                                value={data[key] ?? ""}
                                onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                                placeholder={f.placeholder}
                              />
                            )}
                            {f.hint && (
                              <div className="text-[11px] text-muted-foreground">{f.hint}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Action bar */}
              <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/85 backdrop-blur border-t border-border/60 flex items-center gap-3">
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? "Генерирую…" : "Сгенерировать договор"}
                </Button>
                {genError && <span className="text-xs text-destructive">{genError}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {genResult && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setGenResult(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b border-border/60">
              <h2 className="text-lg font-semibold">Превью договора</h2>
              <button
                className="rounded-lg p-1.5 hover:bg-muted"
                onClick={() => setGenResult(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {genResult.warnings.length > 0 && (
                <div className="rounded-xl border border-yellow-300/60 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-xs space-y-1">
                  <div className="font-medium">⚠ Предупреждения ({genResult.warnings.length}):</div>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {genResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div
                className="prose prose-sm max-w-none border border-border rounded-xl p-5 bg-card"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: genResult.htmlPreview }}
              />
            </div>
            <footer className="flex items-center justify-end gap-2 p-4 border-t border-border/60">
              <Button variant="ghost" onClick={() => setGenResult(null)}>
                Закрыть
              </Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4" /> Скачать .docx
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function loadDraft(id: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(`contract_form_${id}`) ?? "{}");
  } catch {
    return {};
  }
}

function saveDraft(id: string, data: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`contract_form_${id}`, JSON.stringify(data));
  } catch {}
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}
