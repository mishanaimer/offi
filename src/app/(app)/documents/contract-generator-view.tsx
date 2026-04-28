"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Download, FileText, Lock, Sparkles, Trash2, Upload, Wand2, X } from "lucide-react";

type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  source: "system" | "custom";
  canDelete?: boolean;
  warnings?: string[];
  createdAt?: string;
};
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

type TemplateDetails = {
  id: string;
  name: string;
  description: string;
  source: "system" | "custom";
  canDelete: boolean;
  warnings: string[];
  fields: FieldDef[];
};

const KNOWN_GROUPS: { title: string; matcher: (k: string) => boolean }[] = [
  { title: "Договор", matcher: (k) => k.startsWith("contract_") || k.startsWith("act_") || k === "service_start_date" },
  { title: "Контрагент", matcher: (k) => k.startsWith("client_full") || k.startsWith("client_short") || k.startsWith("client_legal") || k.startsWith("client_actual") },
  { title: "Подписант", matcher: (k) => k.startsWith("signatory_") || k.startsWith("client_signatory") },
  { title: "Реквизиты", matcher: (k) => ["client_inn","client_kpp","client_ogrn","client_bank","client_account","client_corr_account","client_bik","client_email"].includes(k) || k === "client_phone" },
  { title: "Услуга / точка", matcher: (k) => k.startsWith("service_") || k.startsWith("spec_") },
];

function groupFields(fields: FieldDef[]): { title: string; fields: FieldDef[] }[] {
  const buckets: Record<string, FieldDef[]> = {};
  const order: string[] = [];
  const otherTitle = "Прочее";
  for (const f of fields) {
    const grp = KNOWN_GROUPS.find((g) => g.matcher(f.key))?.title ?? otherTitle;
    if (!buckets[grp]) {
      buckets[grp] = [];
      order.push(grp);
    }
    buckets[grp].push(f);
  }
  // Стабильный порядок: known groups в порядке KNOWN_GROUPS, "прочее" в конце
  const known = KNOWN_GROUPS.map((g) => g.title);
  order.sort((a, b) => {
    const ai = known.indexOf(a);
    const bi = known.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return order.map((title) => ({ title, fields: buckets[title] }));
}

export function ContractGeneratorView() {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<TemplateDetails | null>(null);
  const [data, setData] = useState<Record<string, string>>({});

  const [pasteText, setPasteText] = useState("");
  const [parseStatus, setParseStatus] = useState<{ msg: string; tone: "ok" | "warn" | "err" } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResp | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshTemplates(autoSelect?: string) {
    setLoadingList(true);
    try {
      const r = await fetch("/api/documents/templates");
      const j = (await r.json()) as { templates: TemplateMeta[] };
      setTemplates(j.templates);
      if (autoSelect) setSelectedId(autoSelect);
      else if (!selectedId && j.templates.length) setSelectedId(j.templates[0].id);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    fetch(`/api/documents/templates/${selectedId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить шаблон");
        return r.json();
      })
      .then((j: TemplateDetails) => {
        setDetails(j);
        const saved = loadDraft(selectedId);
        const initial: Record<string, string> = {};
        for (const f of j.fields) initial[f.key] = saved[f.key] ?? "";
        setData(initial);
      })
      .catch(() => setDetails(null));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    saveDraft(selectedId, data);
  }, [selectedId, data]);

  const fieldsByKey = useMemo(() => {
    const m: Record<string, FieldDef> = {};
    if (details) for (const f of details.fields) m[f.key] = f;
    return m;
  }, [details]);

  const groupedFields = useMemo(() => (details ? groupFields(details.fields) : []), [details]);

  const systemTemplates = templates.filter((t) => t.source === "system");
  const customTemplates = templates.filter((t) => t.source === "custom");

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
      setParseStatus({
        msg: filled ? `✓ Заполнено полей: ${filled}` : "Поля не найдены — проверь текст",
        tone: filled ? "ok" : "warn",
      });
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

  async function handleUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setUploadStatus("Принимаются только .docx");
      return;
    }
    setUploading(true);
    setUploadStatus("Загружаю и анализирую договор… (10–30 сек)");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/documents/templates", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Ошибка загрузки");
      }
      const j = (await r.json()) as {
        id: string;
        name: string;
        fieldsCount: number;
        replacementsCount: number;
        warnings: string[];
      };
      setUploadStatus(
        `✓ Шаблон «${j.name}» создан: ${j.fieldsCount} полей, ${j.replacementsCount} правил замены` +
          (j.warnings.length ? `, ${j.warnings.length} предупреждений` : "")
      );
      await refreshTemplates(j.id);
    } catch (e) {
      setUploadStatus("Ошибка: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить шаблон? Это действие необратимо.")) return;
    const r = await fetch(`/api/documents/templates/${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert("Не удалось удалить: " + (await r.text()));
      return;
    }
    if (selectedId === id) setSelectedId(null);
    await refreshTemplates();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <div className="grid md:grid-cols-[300px_1fr] flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="border-r border-border/60 overflow-y-auto md:min-h-0 flex flex-col">
        {/* Upload zone */}
        <div className="p-3 border-b border-border/60">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-border hover:border-primary cursor-pointer p-4 flex flex-col items-center justify-center text-center transition gap-1 bg-muted/30 hover:bg-[hsl(var(--accent-brand-light))]"
          >
            {uploading ? (
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
            <div className="text-xs font-medium">Загрузить .docx-договор</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              ИИ сам сделает из него заполняемый шаблон
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          {uploadStatus && (
            <div
              className={`mt-2 text-[11px] ${
                uploadStatus.startsWith("Ошибка") ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {uploadStatus}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-sm text-muted-foreground">Загружаю шаблоны…</div>
          ) : (
            <>
              {systemTemplates.length > 0 && (
                <div className="p-3 space-y-1">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Системные
                  </div>
                  {systemTemplates.map((t) => (
                    <TemplateRow
                      key={t.id}
                      t={t}
                      selected={selectedId === t.id}
                      onSelect={() => setSelectedId(t.id)}
                    />
                  ))}
                </div>
              )}
              {customTemplates.length > 0 && (
                <div className="p-3 space-y-1 border-t border-border/40">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Свои шаблоны
                  </div>
                  {customTemplates.map((t) => (
                    <TemplateRow
                      key={t.id}
                      t={t}
                      selected={selectedId === t.id}
                      onSelect={() => setSelectedId(t.id)}
                      onDelete={() => handleDelete(t.id)}
                    />
                  ))}
                </div>
              )}
              {systemTemplates.length === 0 && customTemplates.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">
                  Нет шаблонов. Загрузи первый .docx сверху.
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="overflow-y-auto">
        <div className="container-page max-w-3xl py-6 space-y-5">
          {!selectedId || !details ? (
            <div className="text-sm text-muted-foreground">
              Выбери шаблон слева или загрузи свой .docx, чтобы ИИ сделал из него заполняемый
              шаблон.
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs text-muted-foreground">
                  {details.source === "system" ? "Системный шаблон" : "Свой шаблон"}
                </div>
                <h2 className="text-xl font-semibold">{details.name}</h2>
                {details.description && (
                  <p className="text-sm text-muted-foreground mt-1">{details.description}</p>
                )}
              </div>

              {details.warnings && details.warnings.length > 0 && (
                <div className="rounded-xl border border-yellow-300/60 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-xs space-y-1">
                  <div className="font-medium">⚠ Замечания при анализе шаблона:</div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    {details.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Paste-area */}
              <div className="card-surface p-5 space-y-3">
                <div className="font-medium flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" /> Распознать реквизиты из текста
                </div>
                <p className="text-xs text-muted-foreground">
                  Вставь карточку контрагента — ИНН, КПП, ОГРН, счета, банк, адреса и подписант
                  заполнятся автоматически (если поля совпадают).
                </p>
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"ООО «АЛОЭ»\nИНН 7814293260, КПП 781401001, ОГРН 1157847365015\n…"}
                  className="min-h-[120px] font-mono text-xs"
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

              {/* Fields */}
              {groupedFields.map((group) => (
                <div key={group.title} className="card-surface p-5 space-y-4">
                  <div className="text-sm font-medium">{group.title}</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {group.fields.map((f) => {
                      const isTextarea = f.type === "textarea";
                      return (
                        <div
                          key={f.key}
                          className={`space-y-1.5 ${isTextarea ? "sm:col-span-2" : ""}`}
                        >
                          <label htmlFor={`f_${f.key}`} className="text-xs text-muted-foreground">
                            {f.label}
                          </label>
                          {isTextarea ? (
                            <Textarea
                              id={`f_${f.key}`}
                              value={data[f.key] ?? ""}
                              onChange={(e) =>
                                setData((d) => ({ ...d, [f.key]: e.target.value }))
                              }
                              placeholder={f.placeholder}
                              className="min-h-[72px]"
                            />
                          ) : (
                            <Input
                              id={`f_${f.key}`}
                              value={data[f.key] ?? ""}
                              onChange={(e) =>
                                setData((d) => ({ ...d, [f.key]: e.target.value }))
                              }
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
              ))}

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
              <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => setGenResult(null)}>
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

function TemplateRow({
  t,
  selected,
  onSelect,
  onDelete,
}: {
  t: TemplateMeta;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`group rounded-xl px-2.5 py-2 flex items-start gap-2 transition cursor-pointer ${
        selected ? "bg-muted" : "hover:bg-muted/60"
      }`}
      onClick={onSelect}
    >
      {t.source === "system" ? (
        <Lock className="w-3.5 h-3.5 mt-1 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="w-3.5 h-3.5 mt-1 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {t.name}
          {t.warnings && t.warnings.length > 0 && (
            <span
              title={`${t.warnings.length} замечаний при анализе`}
              className="text-[10px] text-yellow-600"
            >
              ⚠ {t.warnings.length}
            </span>
          )}
        </div>
        {t.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 leading-snug">
            {t.description}
          </div>
        )}
      </div>
      {onDelete && (
        <button
          className="opacity-0 group-hover:opacity-100 transition shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Удалить шаблон"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
