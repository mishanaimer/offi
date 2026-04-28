"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Download, Eye, FileText, Pencil, Sparkles, Trash2, Upload, Wand2, X } from "lucide-react";

type TemplateMeta = {
  id: string;
  name: string;
  description: string;
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
  canDelete: boolean;
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

  const [templatePreviewBase64, setTemplatePreviewBase64] = useState<string | null>(null);
  const [templatePlainText, setTemplatePlainText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingText, setEditingText] = useState<string>("");
  const [savingText, setSavingText] = useState(false);
  const [textEditStatus, setTextEditStatus] = useState<string | null>(null);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");

  const cardFileRef = useRef<HTMLInputElement>(null);
  const [cardLoading, setCardLoading] = useState(false);

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
      setTemplatePreviewBase64(null);
      return;
    }
    setTemplatePreviewBase64(null);
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
    // лениво подгружаем «шаблонный» docx (с {{плейсхолдерами}}) + plain-text для редактора
    fetch(`/api/documents/templates/${selectedId}/preview`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { docxBase64: string; plainText?: string }) => {
        setTemplatePreviewBase64(j.docxBase64);
        setTemplatePlainText(j.plainText ?? null);
      })
      .catch(() => {
        setTemplatePreviewBase64(null);
        setTemplatePlainText(null);
      });
  }, [selectedId]);

  // Когда модалка превью открыта и есть docx — рендерим его постранично
  // через docx-preview и пост-обрабатываем плейсхолдеры подсветкой.
  useEffect(() => {
    if (!showPreview || !templatePreviewBase64 || !previewMountRef.current) return;
    let cancelled = false;
    (async () => {
      const docxPreview = await import("docx-preview");
      const bytes = base64ToBytes(templatePreviewBase64);
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (cancelled || !previewMountRef.current) return;
      previewMountRef.current.innerHTML = "";
      await docxPreview.renderAsync(blob, previewMountRef.current, undefined, {
        className: "docx",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: false,
      });
      if (cancelled || !previewMountRef.current) return;
      // Подсветка {{key}} красивыми карточками с label/иконкой
      const fieldsMap: Record<string, { label: string; type?: string }> = {};
      for (const f of details?.fields ?? []) fieldsMap[f.key] = { label: f.label, type: f.type };
      highlightPlaceholders(previewMountRef.current, fieldsMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [showPreview, templatePreviewBase64, details]);

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

  function applyParsed(parsed: Record<string, string>): number {
    let filled = 0;
    const next = { ...data };
    for (const k of Object.keys(parsed)) {
      if (k in fieldsByKey) {
        next[k] = parsed[k];
        filled++;
      }
    }
    setData(next);
    return filled;
  }

  async function handleParse() {
    const text = pasteText.trim();
    if (!text) {
      setParseStatus({ msg: "Сначала вставь текст", tone: "warn" });
      return;
    }
    setParseStatus({ msg: "Распознаю (regex + ИИ)…", tone: "ok" });
    try {
      const r = await fetch("/api/documents/parse-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fields: details?.fields ?? [] }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as {
        parsed: Record<string, string>;
        counts?: { regex: number; ai: number; total: number };
      };
      const filled = applyParsed(j.parsed);
      const ai = j.counts?.ai ?? 0;
      setParseStatus({
        msg: filled
          ? `✓ Заполнено полей: ${filled}${ai ? ` (из них ${ai} распознал ИИ)` : ""}`
          : "Поля не найдены — проверь текст",
        tone: filled ? "ok" : "warn",
      });
    } catch (e) {
      setParseStatus({ msg: "Ошибка: " + (e as Error).message, tone: "err" });
    }
  }

  async function handleCardFile(file: File) {
    setCardLoading(true);
    setParseStatus({ msg: `Читаю файл «${file.name}» и анализирую с ИИ…`, tone: "ok" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fields", JSON.stringify(details?.fields ?? []));
      const r = await fetch("/api/documents/parse-card", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as {
        text: string;
        parsed: Record<string, string>;
        counts?: { regex: number; ai: number; total: number };
      };
      setPasteText(j.text);
      const filled = applyParsed(j.parsed);
      const ai = j.counts?.ai ?? 0;
      setParseStatus({
        msg: filled
          ? `✓ Из файла «${file.name}» заполнено полей: ${filled}${ai ? ` (из них ${ai} распознал ИИ)` : ""}`
          : `Из файла «${file.name}» извлечён текст, но реквизиты не распознались — проверь и добавь вручную`,
        tone: filled ? "ok" : "warn",
      });
    } catch (e) {
      setParseStatus({ msg: "Ошибка: " + (e as Error).message, tone: "err" });
    } finally {
      setCardLoading(false);
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

  const [needsMigration, setNeedsMigration] = useState(false);

  async function handleUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setUploadStatus("Принимаются только .docx");
      return;
    }
    setUploading(true);
    setUploadStatus("Загружаю и анализирую договор… (10–30 сек)");
    setNeedsMigration(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/documents/templates", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const t = await r.text();
        if (t.includes("contract_templates")) setNeedsMigration(true);
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

  async function persistFields(newFields: FieldDef[]) {
    if (!details || !selectedId) return;
    setDetails({ ...details, fields: newFields });
    await fetch(`/api/documents/templates/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: newFields }),
    });
  }

  async function handleRemoveField(key: string) {
    if (!details) return;
    const newFields = details.fields.filter((f) => f.key !== key);
    await persistFields(newFields);
  }

  async function handleRenameField(key: string, newLabel: string) {
    if (!details) return;
    const newFields = details.fields.map((f) => (f.key === key ? { ...f, label: newLabel } : f));
    await persistFields(newFields);
    setEditingFieldKey(null);
  }

  function startEditingText() {
    if (templatePlainText == null) return;
    setEditingText(templatePlainText);
    setEditMode(true);
    setTextEditStatus(null);
  }

  function cancelEditingText() {
    setEditMode(false);
    setEditingText("");
    setTextEditStatus(null);
  }

  // Простой построчный диф: для пары (origLine, editedLine) на одинаковом
  // индексе — если разные, добавляем правило {old, new}. Этого хватает
  // для типичных правок (поправить опечатку, переписать формулировку).
  function buildLineEdits(orig: string, edited: string): Array<{ old: string; new: string }> {
    const a = orig.split(/\r?\n/);
    const b = edited.split(/\r?\n/);
    const len = Math.min(a.length, b.length);
    const out: Array<{ old: string; new: string }> = [];
    for (let i = 0; i < len; i++) {
      const oa = a[i].trim();
      const ob = b[i].trim();
      if (!oa || oa === ob) continue;
      // Защита: не сохраняем правки на строках с плейсхолдерами — иначе
      // сломаем замены полей. Пользователь может удалить плейсхолдер,
      // редактируя поле через ✎/🗑.
      if (oa.includes("{{") || ob.includes("{{")) continue;
      out.push({ old: oa, new: ob });
    }
    return out;
  }

  async function saveEditingText() {
    if (!selectedId || templatePlainText == null) return;
    const edits = buildLineEdits(templatePlainText, editingText);
    if (edits.length === 0) {
      setTextEditStatus("Изменений нет");
      return;
    }
    setSavingText(true);
    setTextEditStatus(`Сохраняю ${edits.length} правок…`);
    try {
      const r = await fetch(`/api/documents/templates/${selectedId}/text-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { applied: number; message?: string };
      if (j.applied > 0) {
        setTextEditStatus(`✓ Сохранено правок: ${j.applied}`);
        // Перерисуем превью + plain-text — там теперь обновлённый шаблон
        const pr = await fetch(`/api/documents/templates/${selectedId}/preview`);
        if (pr.ok) {
          const p = (await pr.json()) as { docxBase64: string; plainText?: string };
          setTemplatePreviewBase64(p.docxBase64);
          setTemplatePlainText(p.plainText ?? null);
          setEditingText(p.plainText ?? "");
        }
        setEditMode(false);
      } else {
        setTextEditStatus(j.message ?? "Не удалось применить правки — текст не найден в шаблоне");
      }
    } catch (e) {
      setTextEditStatus("Ошибка: " + (e as Error).message);
    } finally {
      setSavingText(false);
    }
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
          {needsMigration && (
            <div className="mt-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300/60 p-2.5 text-[11px] space-y-1.5">
              <div className="font-medium">База ещё не настроена</div>
              <div className="text-muted-foreground leading-relaxed">
                Чтобы заработала загрузка шаблонов, открой Supabase → SQL Editor и выполни
                миграцию <code className="bg-muted px-1 rounded">supabase/migrations/0010_contract_templates.sql</code>{" "}
                из репозитория. Она создаст таблицы и приватный bucket для файлов.
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-sm text-muted-foreground">Загружаю шаблоны…</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground leading-relaxed">
              Пока нет шаблонов. Загрузи .docx-договор — ИИ найдёт в нём переменные части
              (контрагент, реквизиты, даты, подписант) и сделает заполняемый шаблон.
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {templates.map((t) => (
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{details.name}</h2>
                  {details.description && (
                    <p className="text-sm text-muted-foreground mt-1">{details.description}</p>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Полей: {details.fields.length}
                  </div>
                </div>
                {templatePreviewBase64 && (
                  <Button variant="secondary" size="sm" onClick={() => setShowPreview(true)}>
                    <Eye className="w-4 h-4" /> Посмотреть шаблон
                  </Button>
                )}
              </div>

              {/* Paste-area + drop карточки */}
              <div className="card-surface p-5 space-y-3">
                <div className="font-medium flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" /> Заполнить реквизиты контрагента
                </div>
                <p className="text-xs text-muted-foreground">
                  Перетащи файл карточки (PDF / DOCX / TXT / CSV) или вставь текст — ИНН, КПП,
                  ОГРН, счета, банк, адреса и подписант заполнятся автоматически.
                </p>

                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleCardFile(f);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => cardFileRef.current?.click()}
                  className="rounded-xl border border-dashed border-border hover:border-primary cursor-pointer p-3 flex items-center gap-3 bg-muted/20 hover:bg-[hsl(var(--accent-brand-light))] transition"
                >
                  {cardLoading ? (
                    <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
                  ) : (
                    <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="text-xs leading-snug">
                    <div className="font-medium">Загрузить файл карточки</div>
                    <div className="text-muted-foreground">
                      PDF, DOCX, TXT, CSV — текст и реквизиты вытащим сами
                    </div>
                  </div>
                </div>
                <input
                  ref={cardFileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.csv,.md,.html,.htm,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCardFile(f);
                    e.target.value = "";
                  }}
                />

                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"…или вставь текст карточки сюда:\nООО «АЛОЭ»\nИНН 7814293260, КПП 781401001, ОГРН 1157847365015\n…"}
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
                      const isEditing = editingFieldKey === f.key;
                      return (
                        <div
                          key={f.key}
                          className={`space-y-1.5 group/field ${isTextarea ? "sm:col-span-2" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2 min-h-[18px]">
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-1">
                                <input
                                  autoFocus
                                  value={editingLabel}
                                  onChange={(e) => setEditingLabel(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameField(f.key, editingLabel);
                                    if (e.key === "Escape") setEditingFieldKey(null);
                                  }}
                                  className="text-xs flex-1 bg-card border border-primary rounded px-1.5 py-0.5 outline-none"
                                />
                                <button
                                  className="text-xs px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground"
                                  onClick={() => handleRenameField(f.key, editingLabel)}
                                  title="Сохранить"
                                >
                                  ✓
                                </button>
                                <button
                                  className="text-xs px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground"
                                  onClick={() => setEditingFieldKey(null)}
                                  title="Отмена"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <label htmlFor={`f_${f.key}`} className="text-xs text-muted-foreground truncate">
                                  {f.label}
                                </label>
                                <div className="opacity-0 group-hover/field:opacity-100 transition flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingFieldKey(f.key);
                                      setEditingLabel(f.label);
                                    }}
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                    title="Переименовать"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveField(f.key)}
                                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                    title="Удалить поле"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
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

      {/* Template preview modal — постраничный рендер docx-preview */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => {
            setShowPreview(false);
            cancelEditingText();
          }}
        >
          <div
            className="bg-[#e8eaed] rounded-2xl shadow-xl max-w-5xl w-full max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background rounded-t-2xl gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">Шаблон договора</h2>
                {details && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {details.name} · {details.fields.length} полей
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!editMode ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={startEditingText}
                    disabled={templatePlainText == null}
                  >
                    <Pencil className="w-4 h-4" /> Редактировать текст
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={cancelEditingText} disabled={savingText}>
                      Отмена
                    </Button>
                    <Button size="sm" onClick={saveEditingText} disabled={savingText}>
                      {savingText ? "Сохраняю…" : "Сохранить правки"}
                    </Button>
                  </>
                )}
                <button
                  className="rounded-lg p-1.5 hover:bg-muted"
                  onClick={() => {
                    setShowPreview(false);
                    cancelEditingText();
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {textEditStatus && (
              <div
                className={`px-4 py-2 text-xs border-b border-border/60 bg-background ${
                  textEditStatus.startsWith("Ошибка")
                    ? "text-destructive"
                    : textEditStatus.startsWith("✓")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {textEditStatus}
              </div>
            )}

            {editMode ? (
              <div className="flex-1 overflow-hidden grid lg:grid-cols-2 gap-0 bg-background">
                <div className="overflow-auto p-4 border-r border-border/60">
                  <div className="text-xs text-muted-foreground mb-2">
                    Редактируй текст слева — поля-карточки в превью справа останутся
                    неизменными. Изменённые строки сохранятся как правила замены в шаблоне.
                  </div>
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="min-h-[60vh] font-mono text-xs leading-relaxed"
                  />
                </div>
                <div className="overflow-auto p-4">
                  <div className="text-xs text-muted-foreground mb-2">Превью</div>
                  {templatePreviewBase64 ? (
                    <div ref={previewMountRef} className="docx-preview-host" />
                  ) : (
                    <div className="text-sm text-muted-foreground">Готовлю превью…</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-6 flex justify-center">
                {!templatePreviewBase64 ? (
                  <div className="text-sm text-muted-foreground self-center">Готовлю превью…</div>
                ) : (
                  <div ref={previewMountRef} className="docx-preview-host" />
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
      <FileText className="w-3.5 h-3.5 mt-1 text-muted-foreground shrink-0" />
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

// Обходит DOM и оборачивает все вхождения {{key}} в красивые карточки
// с человеческой подписью поля и иконкой типа.
const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

function pickIconForKey(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("date") || k.includes("day") || k.includes("month") || k.includes("year"))
    return "📅";
  if (k.includes("inn") || k.includes("kpp") || k.includes("ogrn") || k.includes("bik"))
    return "🔢";
  if (k.includes("account") || k.includes("bank")) return "🏦";
  if (k.includes("email")) return "✉️";
  if (k.includes("phone") || k.includes("tel")) return "📞";
  if (k.includes("address") || k.includes("addr")) return "📍";
  if (k.includes("signatory") || k.includes("director") || k.includes("podpisant"))
    return "👤";
  if (k.includes("price") || k.includes("amount") || k.includes("cost") || k.includes("sum"))
    return "💰";
  if (k.includes("speed")) return "⚡";
  if (k.includes("number") || k.includes("num")) return "№";
  if (k.includes("client") || k.includes("contractor") || k.includes("contragent"))
    return "🏢";
  return "•";
}

function highlightPlaceholders(
  root: HTMLElement,
  fieldsMap: Record<string, { label: string; type?: string }>
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    const t = node as Text;
    if (t.nodeValue && t.nodeValue.includes("{{")) targets.push(t);
  }
  for (const t of targets) {
    const text = t.nodeValue ?? "";
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    PLACEHOLDER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
      if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      const span = document.createElement("span");
      span.className = "tpl-placeholder";
      const key = m[1];
      span.setAttribute("data-key", key);
      span.setAttribute("contenteditable", "false");

      const meta = fieldsMap[key];
      const label = meta?.label || key;

      const icon = document.createElement("span");
      icon.className = "tpl-placeholder-icon";
      icon.textContent = pickIconForKey(key);
      span.appendChild(icon);

      const labelEl = document.createElement("span");
      labelEl.className = "tpl-placeholder-label";
      labelEl.textContent = label;
      span.appendChild(labelEl);

      frag.appendChild(span);
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    t.parentNode?.replaceChild(frag, t);
  }
}
