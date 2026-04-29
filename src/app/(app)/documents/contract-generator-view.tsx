"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ProgressBar, type ProgressStage } from "@/components/ui/progress-bar";
import {
  AlertTriangle,
  Bold,
  Download,
  Eye,
  FileText,
  GripVertical,
  Italic,
  LayoutGrid,
  Pencil,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Underline,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

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
  /** Группа для отображения в редакторе. Если не задана — выводится по KNOWN_GROUPS-matcher. */
  group?: string;
};

const ANALYZE_STAGES: ProgressStage[] = [
  { id: "extract", label: "Распаковываю и нормализую договор…", weight: 0.12 },
  { id: "ai", label: "ИИ ищет переменные части (контрагент, реквизиты, даты)…", weight: 0.76 },
  { id: "save", label: "Сохраняю шаблон…", weight: 0.12 },
];

const PARSE_STAGES: ProgressStage[] = [
  { id: "read", label: "Читаю файл и извлекаю текст…", weight: 0.2 },
  { id: "ai", label: "ИИ распознаёт реквизиты…", weight: 0.7 },
  { id: "apply", label: "Заполняю поля…", weight: 0.1 },
];

const GENERATE_STAGES: ProgressStage[] = [
  { id: "validate", label: "Подставляю данные в шаблон…", weight: 0.4 },
  { id: "render", label: "Собираю финальный .docx…", weight: 0.4 },
  { id: "preview", label: "Готовлю превью…", weight: 0.2 },
];

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

/** Определяет имя группы для поля: явный f.group, иначе по matcher, иначе «Прочее». */
function inferGroup(f: FieldDef): string {
  if (f.group && f.group.trim()) return f.group;
  return KNOWN_GROUPS.find((g) => g.matcher(f.key))?.title ?? "Прочее";
}

function groupFields(fields: FieldDef[]): { title: string; fields: FieldDef[] }[] {
  const buckets: Record<string, FieldDef[]> = {};
  const order: string[] = [];
  for (const f of fields) {
    const grp = inferGroup(f);
    if (!buckets[grp]) {
      buckets[grp] = [];
      order.push(grp);
    }
    buckets[grp].push(f);
  }
  // Стабильный порядок: known groups в порядке KNOWN_GROUPS, кастомные/«прочее» в конце
  // в порядке появления.
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

/** Уникальный slug-key из label, с защитой от коллизии. */
function makeFieldKey(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/giu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "custom";
  // Транслит для кириллицы — простой вариант.
  const ru: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"c",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  const slug = base.replace(/[а-яё]/g, (c) => ru[c] ?? "");
  let key = slug || `custom_${Date.now().toString(36)}`;
  let n = 1;
  while (existing.has(key)) {
    key = `${slug}_${n++}`;
  }
  return key;
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
  const [savingText, setSavingText] = useState(false);
  const [textEditStatus, setTextEditStatus] = useState<string | null>(null);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const editSnapshotRef = useRef<string>("");
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");

  const cardFileRef = useRef<HTMLInputElement>(null);
  const [cardLoading, setCardLoading] = useState(false);

  // Прогресс-этапы для разных операций (псевдо-стадии — сервер не стримит).
  const [analyzeStage, setAnalyzeStage] = useState<string | null | "done">(null);
  const [parseStage, setParseStage] = useState<string | null | "done">(null);
  const [genStage, setGenStage] = useState<string | null | "done">(null);

  // Drag-and-drop карточек полей.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ group: string; beforeKey?: string } | null>(null);

  // Pre-flight check перед генерацией (показ модалки с предупреждением).
  const [preflightOpen, setPreflightOpen] = useState(false);

  // Менеджер «Поля» (панель внутри редактора шаблона) — открыт по умолчанию.
  const [showFieldsPanel, setShowFieldsPanel] = useState(true);

  // Множество ключей плейсхолдеров, реально расставленных в документе.
  // Считается по previewMountRef и пересчитывается при каждой операции DnD.
  const [placeholdersInDoc, setPlaceholdersInDoc] = useState<Set<string>>(new Set());

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
      refreshPlaceholdersInDoc();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, templatePreviewBase64, details]);

  /** Когда вошли в edit mode — каждой расставленной карточке добавляем
   *  draggable + кнопку удаления + обработчики. При выходе из edit mode —
   *  снимаем (чтобы пользователь не мог случайно удалить в read-only). */
  useEffect(() => {
    if (!previewMountRef.current) return;
    const root = previewMountRef.current;
    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>(".tpl-placeholder"));
    if (editMode) {
      // Перевешиваем как live-spans (в т.ч. созданные drop’ом — у них уже всё есть).
      for (const span of spans) {
        if (span.dataset.tplWired === "1") continue;
        const key = span.getAttribute("data-key") ?? "";
        if (!key) continue;
        span.setAttribute("draggable", "true");
        span.dataset.tplWired = "1";

        const onDragStart = (e: DragEvent) => {
          if (!e.dataTransfer) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-tpl-key", key);
          e.dataTransfer.setData("text/plain", `{{${key}}}`);
          span.classList.add("is-dragging");
          (window as any).__tplDragNode = span;
        };
        const onDragEnd = () => {
          span.classList.remove("is-dragging");
          (window as any).__tplDragNode = null;
        };
        span.addEventListener("dragstart", onDragStart);
        span.addEventListener("dragend", onDragEnd);

        if (!span.querySelector(".tpl-placeholder-delete")) {
          const del = document.createElement("span");
          del.className = "tpl-placeholder-delete";
          del.textContent = "×";
          del.title = "Убрать карточку из документа";
          del.addEventListener("mousedown", (e) => e.preventDefault());
          del.addEventListener("click", (e) => {
            e.stopPropagation();
            span.remove();
            refreshPlaceholdersInDoc();
          });
          span.appendChild(del);
        }
      }
    } else {
      // Снимаем интерактив у всех карточек.
      for (const span of spans) {
        span.removeAttribute("draggable");
        delete span.dataset.tplWired;
        span.querySelector(".tpl-placeholder-delete")?.remove();
        span.classList.remove("is-dragging");
      }
    }
  }, [editMode, placeholdersInDoc]);

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
    setParseStatus(null);
    setParseStage("read");
    const t1 = setTimeout(() => setParseStage("ai"), 600);
    try {
      const r = await fetch("/api/documents/parse-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fields: details?.fields ?? [] }),
      });
      if (!r.ok) throw new Error(await r.text());
      setParseStage("apply");
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
      setParseStage("done");
      setTimeout(() => setParseStage(null), 700);
    } catch (e) {
      setParseStatus({ msg: "Ошибка: " + (e as Error).message, tone: "err" });
      setParseStage(null);
    } finally {
      clearTimeout(t1);
    }
  }

  async function handleCardFile(file: File) {
    setCardLoading(true);
    setParseStatus(null);
    setParseStage("read");
    const t1 = setTimeout(() => setParseStage("ai"), 1200);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fields", JSON.stringify(details?.fields ?? []));
      const r = await fetch("/api/documents/parse-card", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      setParseStage("apply");
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
      setParseStage("done");
      setTimeout(() => setParseStage(null), 700);
    } catch (e) {
      setParseStatus({ msg: "Ошибка: " + (e as Error).message, tone: "err" });
      setParseStage(null);
    } finally {
      clearTimeout(t1);
      setCardLoading(false);
    }
  }

  // Список незаполненных обязательных полей (для pre-flight модалки).
  const missingRequired = useMemo(() => {
    if (!details) return [] as FieldDef[];
    return details.fields.filter((f) => f.required && !((data[f.key] ?? "").trim()));
  }, [details, data]);

  function handleGenerateClick() {
    if (missingRequired.length > 0) {
      setPreflightOpen(true);
      return;
    }
    void handleGenerate();
  }

  async function handleGenerate() {
    if (!selectedId) return;
    setPreflightOpen(false);
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    setGenStage("validate");
    const t1 = setTimeout(() => setGenStage("render"), 800);
    let t2: ReturnType<typeof setTimeout> | null = null;
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
      setGenStage("preview");
      const result = (await r.json()) as GenerateResp;
      setGenResult(result);
      setGenStage("done");
      t2 = setTimeout(() => setGenStage(null), 700);
    } catch (e) {
      setGenError((e as Error).message);
      setGenStage(null);
    } finally {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
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
    setUploadStatus(null);
    setNeedsMigration(false);
    setAnalyzeStage("extract");
    const t1 = setTimeout(() => setAnalyzeStage("ai"), 1500);
    let t2: ReturnType<typeof setTimeout> | null = null;
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
      setAnalyzeStage("save");
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
      setAnalyzeStage("done");
      t2 = setTimeout(() => setAnalyzeStage(null), 800);
    } catch (e) {
      setUploadStatus("Ошибка: " + (e as Error).message);
      setAnalyzeStage(null);
    } finally {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
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

  /** Добавить новое placeholder-поле в указанную группу. Сразу включает inline-rename. */
  async function handleAddField(groupTitle: string) {
    if (!details) return;
    const existing = new Set(details.fields.map((f) => f.key));
    const label = "Новое поле";
    const key = makeFieldKey(`custom_${groupTitle}`, existing);
    const newField: FieldDef = { key, label, group: groupTitle, type: "text" };
    // Вставляем в конец группы.
    const next = [...details.fields];
    let insertAt = next.length;
    for (let i = next.length - 1; i >= 0; i--) {
      if (inferGroup(next[i]) === groupTitle) {
        insertAt = i + 1;
        break;
      }
    }
    next.splice(insertAt, 0, newField);
    await persistFields(next);
    setData((d) => ({ ...d, [key]: "" }));
    setEditingFieldKey(key);
    setEditingLabel(label);
  }

  /** Добавить новую группу с одним стартовым полем. */
  async function handleAddGroup() {
    if (!details) return;
    const baseName = "Новая секция";
    const existingTitles = new Set(groupedFields.map((g) => g.title));
    let name = baseName;
    let n = 2;
    while (existingTitles.has(name)) name = `${baseName} ${n++}`;
    const existingKeys = new Set(details.fields.map((f) => f.key));
    const key = makeFieldKey(`custom_${name}`, existingKeys);
    const newField: FieldDef = { key, label: "Новое поле", group: name, type: "text" };
    await persistFields([...details.fields, newField]);
    setData((d) => ({ ...d, [key]: "" }));
    setEditingFieldKey(key);
    setEditingLabel("Новое поле");
  }

  /** Перетаскивание: вставить srcKey в группу targetGroup перед beforeKey
   *  (или в конец группы, если beforeKey не указан). */
  async function moveField(srcKey: string, targetGroup: string, beforeKey?: string) {
    if (!details) return;
    if (srcKey === beforeKey) return;
    const src = details.fields.find((f) => f.key === srcKey);
    if (!src) return;
    const updatedSrc: FieldDef = { ...src, group: targetGroup };
    const remaining = details.fields.filter((f) => f.key !== srcKey);
    let insertAt = remaining.length;
    if (beforeKey) {
      const bi = remaining.findIndex((f) => f.key === beforeKey);
      if (bi >= 0) insertAt = bi;
    } else {
      // в конец группы
      let lastInGroup = -1;
      remaining.forEach((f, i) => {
        if (inferGroup(f) === targetGroup) lastInGroup = i;
      });
      insertAt = lastInGroup + 1;
    }
    const next = [...remaining.slice(0, insertAt), updatedSrc, ...remaining.slice(insertAt)];
    await persistFields(next);
  }

  /** Перечитывает DOM превью и обновляет placeholdersInDoc. */
  function refreshPlaceholdersInDoc() {
    if (!previewMountRef.current) return;
    const set = new Set<string>();
    previewMountRef.current.querySelectorAll(".tpl-placeholder").forEach((el) => {
      const k = el.getAttribute("data-key");
      if (k) set.add(k);
    });
    setPlaceholdersInDoc(set);
  }

  /** Создаёт DOM-узел плейсхолдера (как highlightPlaceholders), готовый к вставке. */
  function buildPlaceholderEl(key: string, label: string): HTMLSpanElement {
    const span = document.createElement("span");
    span.className = "tpl-placeholder";
    span.setAttribute("data-key", key);
    span.setAttribute("contenteditable", "false");
    span.setAttribute("draggable", "true");

    const icon = document.createElement("span");
    icon.className = "tpl-placeholder-icon";
    icon.textContent = pickIconForKey(key);
    span.appendChild(icon);

    const labelEl = document.createElement("span");
    labelEl.className = "tpl-placeholder-label";
    labelEl.textContent = label;
    span.appendChild(labelEl);

    const del = document.createElement("span");
    del.className = "tpl-placeholder-delete";
    del.textContent = "×";
    del.title = "Убрать карточку из документа";
    del.addEventListener("mousedown", (e) => e.preventDefault());
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      span.remove();
      refreshPlaceholdersInDoc();
    });
    span.appendChild(del);

    span.addEventListener("dragstart", (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      dt.effectAllowed = "move";
      dt.setData("application/x-tpl-key", key);
      dt.setData("text/plain", `{{${key}}}`);
      span.classList.add("is-dragging");
      // Запоминаем «себя», чтобы при drop’е переместить, а не дублировать.
      (window as any).__tplDragNode = span;
    });
    span.addEventListener("dragend", () => {
      span.classList.remove("is-dragging");
      (window as any).__tplDragNode = null;
    });

    return span;
  }

  /** Получает Range, соответствующий точке экрана (cross-browser). */
  function caretRangeAt(x: number, y: number): Range | null {
    const doc = document as unknown as {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    if (typeof doc.caretRangeFromPoint === "function") {
      return doc.caretRangeFromPoint(x, y);
    }
    if (typeof doc.caretPositionFromPoint === "function") {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos) {
        const r = document.createRange();
        r.setStart(pos.offsetNode, pos.offset);
        r.collapse(true);
        return r;
      }
    }
    return null;
  }

  /** Вставляет плейсхолдер по координатам drop-точки. Если карточка уже была
   *  в документе — переносит существующий узел (move), иначе создаёт новый. */
  function insertPlaceholderAt(clientX: number, clientY: number, key: string) {
    if (!previewMountRef.current) return;
    const range = caretRangeAt(clientX, clientY);
    if (!range) return;
    // Обрезаем range до пределов превью — мало ли что ловится.
    if (!previewMountRef.current.contains(range.startContainer)) return;

    const movingNode: HTMLSpanElement | null = (window as any).__tplDragNode ?? null;

    let node: HTMLSpanElement;
    if (movingNode && movingNode.getAttribute("data-key") === key && previewMountRef.current.contains(movingNode)) {
      // Перенос существующей карточки — снимаем её из текущего места.
      movingNode.parentNode?.removeChild(movingNode);
      movingNode.classList.remove("is-dragging");
      node = movingNode;
    } else {
      const fdef = details?.fields.find((f) => f.key === key);
      const label = fdef?.label || key;
      node = buildPlaceholderEl(key, label);
    }

    range.insertNode(node);
    // Добавляем пробелы вокруг — иначе плейсхолдер сливается со словами.
    if (node.previousSibling && node.previousSibling.nodeType === Node.TEXT_NODE) {
      const prev = node.previousSibling as Text;
      if (!/\s$/.test(prev.data)) prev.data += " ";
    }
    if (node.nextSibling && node.nextSibling.nodeType === Node.TEXT_NODE) {
      const nxt = node.nextSibling as Text;
      if (!/^\s/.test(nxt.data)) nxt.data = " " + nxt.data;
    } else if (!node.nextSibling) {
      node.parentNode?.appendChild(document.createTextNode(" "));
    }
    refreshPlaceholdersInDoc();
  }

  // Собирает текст превью с восстановленными {{key}} вместо карточек.
  function collectPreviewText(root: HTMLElement): string {
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".tpl-placeholder").forEach((ph) => {
      const key = ph.getAttribute("data-key");
      if (key) ph.replaceWith(document.createTextNode(`{{${key}}}`));
    });
    // innerText сохраняет переносы строк по структуре DOM (paragraphs/breaks)
    return (clone as HTMLElement).innerText;
  }

  function startEditingText() {
    if (!previewMountRef.current) return;
    editSnapshotRef.current = collectPreviewText(previewMountRef.current);
    setEditMode(true);
    setTextEditStatus(null);
    // На следующем кадре включим contentEditable + сфокусируем
    requestAnimationFrame(() => {
      if (!previewMountRef.current) return;
      previewMountRef.current.setAttribute("contenteditable", "true");
      (previewMountRef.current as HTMLElement).focus();
    });
  }

  function cancelEditingText() {
    if (previewMountRef.current) {
      previewMountRef.current.setAttribute("contenteditable", "false");
    }
    setEditMode(false);
    setTextEditStatus(null);
    editSnapshotRef.current = "";
  }

  // Построчный диф между двумя текстами с восстановленными {{key}}.
  // Плейсхолдеры в виде {{key}} стабильны (collectPreviewText всегда восстанавливает
  // их одинаково), поэтому строки с {{ можно сравнивать как обычный текст —
  // именно так сохраняются перемещения/удаления карточек в документе.
  function buildLineEdits(orig: string, edited: string): Array<{ old: string; new: string }> {
    const a = orig.split(/\r?\n/);
    const b = edited.split(/\r?\n/);
    const len = Math.min(a.length, b.length);
    const out: Array<{ old: string; new: string }> = [];
    for (let i = 0; i < len; i++) {
      const oa = a[i].trim();
      const ob = b[i].trim();
      if (!oa || oa === ob) continue;
      out.push({ old: oa, new: ob });
    }
    return out;
  }

  function execToolbar(cmd: string) {
    if (!previewMountRef.current) return;
    (previewMountRef.current as HTMLElement).focus();
    document.execCommand(cmd, false);
  }

  async function saveEditingText() {
    if (!selectedId || !previewMountRef.current) return;
    const edited = collectPreviewText(previewMountRef.current);
    const edits = buildLineEdits(editSnapshotRef.current, edited);

    // Какие плейсхолдеры исчезли из документа (удалены/перемещены) —
    // их replacement-правила надо снести на сервере, иначе исходные образцы
    // снова заменятся на {{key}} при генерации.
    const placeholderRe = /\{\{(\w+)\}\}/g;
    const origKeys = new Set<string>();
    const editedKeys = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = placeholderRe.exec(editSnapshotRef.current)) !== null) origKeys.add(m[1]);
    placeholderRe.lastIndex = 0;
    while ((m = placeholderRe.exec(edited)) !== null) editedKeys.add(m[1]);
    const removedKeys = Array.from(origKeys).filter((k) => !editedKeys.has(k));

    if (edits.length === 0 && removedKeys.length === 0) {
      setTextEditStatus("Изменений нет");
      return;
    }
    setSavingText(true);
    const totalOps = edits.length + removedKeys.length;
    setTextEditStatus(`Сохраняю ${totalOps} правок…`);
    try {
      const r = await fetch(`/api/documents/templates/${selectedId}/text-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits, removedKeys }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { applied: number; message?: string };
      if (j.applied > 0) {
        setTextEditStatus(`✓ Сохранено правок: ${j.applied}`);
        // Перерисуем превью + plain-text
        const pr = await fetch(`/api/documents/templates/${selectedId}/preview`);
        if (pr.ok) {
          const p = (await pr.json()) as { docxBase64: string; plainText?: string };
          setTemplatePreviewBase64(p.docxBase64);
          setTemplatePlainText(p.plainText ?? null);
        }
        if (previewMountRef.current) {
          previewMountRef.current.setAttribute("contenteditable", "false");
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
    <div className="grid md:grid-cols-[280px_minmax(0,1fr)] flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="border-r border-border/60 overflow-y-auto md:min-h-0 flex flex-col">
        {/* Upload zone */}
        <div className="p-3 border-b border-border/60">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => !uploading && fileInputRef.current?.click()}
            aria-disabled={uploading}
            className={`rounded-xl border-2 border-dashed border-border p-4 flex flex-col items-center justify-center text-center transition gap-1 bg-muted/30 ${
              uploading
                ? "cursor-progress opacity-90"
                : "hover:border-primary cursor-pointer hover:bg-[hsl(var(--accent-brand-light))]"
            }`}
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
          {analyzeStage !== null && (
            <div className="mt-3">
              <ProgressBar stages={ANALYZE_STAGES} currentStageId={analyzeStage} />
            </div>
          )}
          {uploadStatus && analyzeStage === null && (
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
                <div className="flex items-center gap-2 shrink-0">
                  {templatePreviewBase64 && (
                    <Button variant="secondary" size="sm" onClick={() => setShowPreview(true)}>
                      <Eye className="w-4 h-4" /> Открыть редактор шаблона
                    </Button>
                  )}
                </div>
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
                  <Button variant="secondary" size="sm" onClick={handleParse} disabled={parseStage !== null}>
                    <Sparkles className="w-4 h-4" /> Распознать и заполнить
                  </Button>
                  {parseStatus && parseStage === null && (
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
                {parseStage !== null && (
                  <ProgressBar stages={PARSE_STAGES} currentStageId={parseStage} />
                )}
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
              <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/85 backdrop-blur border-t border-border/60 flex flex-col gap-2.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleGenerateClick} disabled={generating}>
                    {generating ? "Генерирую…" : "Сгенерировать договор"}
                  </Button>
                  {missingRequired.length > 0 && !generating && (
                    <span className="text-xs text-yellow-700 dark:text-yellow-400 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Не заполнено обязательных: {missingRequired.length}
                    </span>
                  )}
                  {genError && <span className="text-xs text-destructive">{genError}</span>}
                </div>
                {genStage !== null && (
                  <ProgressBar
                    stages={GENERATE_STAGES}
                    currentStageId={genStage}
                    error={genError}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pre-flight модалка — перед генерацией предупреждаем о незаполненных обязательных полях. */}
      {preflightOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPreflightOpen(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 p-4 border-b border-border/60">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="text-base font-semibold">Не все обязательные поля заполнены</h3>
            </header>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                В этих полях не указаны значения — в финальном документе на их месте останется
                плейсхолдер. Можно сгенерировать как есть и дозаполнить вручную.
              </p>
              <ul className="text-sm space-y-1">
                {missingRequired.slice(0, 12).map((f) => (
                  <li key={f.key} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                    <span className="truncate">{f.label}</span>
                  </li>
                ))}
                {missingRequired.length > 12 && (
                  <li className="text-xs text-muted-foreground">
                    …и ещё {missingRequired.length - 12}
                  </li>
                )}
              </ul>
            </div>
            <footer className="flex items-center justify-end gap-2 p-4 border-t border-border/60">
              <Button variant="ghost" onClick={() => setPreflightOpen(false)}>
                Заполнить
              </Button>
              <Button onClick={() => void handleGenerate()}>Сгенерировать как есть</Button>
            </footer>
          </div>
        </div>
      )}

      {/* Редактор шаблона — постраничный рендер docx-preview + сайдбар-менеджер карточек */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => {
            setShowPreview(false);
            cancelEditingText();
          }}
        >
          <div
            className="bg-[#e8eaed] rounded-2xl shadow-xl w-full max-w-7xl max-h-[94vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background rounded-t-2xl gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">Редактор шаблона</h2>
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
                    <Pencil className="w-4 h-4" /> Редактировать
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={cancelEditingText} disabled={savingText}>
                      Отмена
                    </Button>
                    <Button size="sm" onClick={saveEditingText} disabled={savingText}>
                      {savingText ? "Сохраняю…" : "Сохранить"}
                    </Button>
                  </>
                )}
                {editMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFieldsPanel((v) => !v)}
                    title={showFieldsPanel ? "Скрыть панель полей" : "Показать панель полей"}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
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

            {editMode && (
              <div className="px-3 py-1.5 border-b border-border/60 bg-background flex items-center gap-1">
                <ToolbarButton title="Жирный (Ctrl+B)" onClick={() => execToolbar("bold")}>
                  <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton title="Курсив (Ctrl+I)" onClick={() => execToolbar("italic")}>
                  <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton title="Подчёркнутый (Ctrl+U)" onClick={() => execToolbar("underline")}>
                  <Underline className="w-4 h-4" />
                </ToolbarButton>
                <div className="w-px h-5 bg-border/60 mx-1" />
                <ToolbarButton title="Отменить (Ctrl+Z)" onClick={() => execToolbar("undo")}>
                  <Undo2 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton title="Повторить (Ctrl+Y)" onClick={() => execToolbar("redo")}>
                  <Redo2 className="w-4 h-4" />
                </ToolbarButton>
                <div className="ml-auto text-[11px] text-muted-foreground">
                  Перетаскивай карточки полей из панели в текст, либо двигай прямо в документе.
                  Удалить карточку — навести и кликнуть «✕».
                </div>
              </div>
            )}

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

            {/* Editor body: документ + (в edit mode) сайдбар карточек справа */}
            <div className="flex-1 min-h-0 grid"
              style={{
                gridTemplateColumns:
                  editMode && showFieldsPanel ? "minmax(0,1fr) 320px" : "minmax(0,1fr)",
              }}
            >
              <div
                className="overflow-auto p-6 flex justify-center"
                onDragOver={(e) => {
                  if (!editMode) return;
                  if (!dragKey && !e.dataTransfer.types.includes("application/x-tpl-key")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  if (!editMode) return;
                  const key =
                    e.dataTransfer.getData("application/x-tpl-key") || dragKey || "";
                  if (!key) return;
                  e.preventDefault();
                  insertPlaceholderAt(e.clientX, e.clientY, key);
                  setDragKey(null);
                }}
              >
                {!templatePreviewBase64 ? (
                  <div className="text-sm text-muted-foreground self-center">Готовлю превью…</div>
                ) : (
                  <div
                    ref={previewMountRef}
                    className={`docx-preview-host ${editMode ? "is-editing" : ""}`}
                    spellCheck={editMode}
                    suppressContentEditableWarning
                  />
                )}
              </div>

              {editMode && showFieldsPanel && details && (
                <aside className="border-l border-border/60 bg-background overflow-y-auto">
                  <div className="px-3 py-2.5 border-b border-border/60 sticky top-0 bg-background z-10">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-primary" /> Карточки полей
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Перетащи карточку прямо в документ — она вставится в позиции курсора.
                      Уже расставленные плейсхолдеры тоже можно перетаскивать и удалять.
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2.5">
                    {groupedFields.map((group) => (
                      <FieldGroupBlock
                        key={group.title}
                        title={group.title}
                        fields={group.fields}
                        editingFieldKey={editingFieldKey}
                        editingLabel={editingLabel}
                        setEditingFieldKey={setEditingFieldKey}
                        setEditingLabel={setEditingLabel}
                        onRename={handleRenameField}
                        onRemove={handleRemoveField}
                        onAddField={() => handleAddField(group.title)}
                        dragKey={dragKey}
                        setDragKey={setDragKey}
                        dropHint={dropHint}
                        setDropHint={setDropHint}
                        onDrop={(srcKey, beforeKey) => moveField(srcKey, group.title, beforeKey)}
                        missingRequired={missingRequired.map((f) => f.key)}
                        usedKeys={placeholdersInDoc}
                      />
                    ))}

                    <button
                      onClick={handleAddGroup}
                      className="w-full rounded-xl border border-dashed border-border hover:border-primary hover:bg-[hsl(var(--accent-brand-light))] p-2.5 text-xs text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить секцию
                    </button>
                  </div>
                </aside>
              )}
            </div>
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

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // не терять выделение в превью
      onClick={onClick}
      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
    >
      {children}
    </button>
  );
}

/* ===========================================================================
 * FieldGroupBlock — компактная карточка-секция в правом сайдбаре. Поддерживает
 * drag-drop карточек полей внутри секции и между секциями, inline-rename,
 * удаление и добавление нового placeholder-поля.
 * =======================================================================*/
function FieldGroupBlock({
  title,
  fields,
  editingFieldKey,
  editingLabel,
  setEditingFieldKey,
  setEditingLabel,
  onRename,
  onRemove,
  onAddField,
  dragKey,
  setDragKey,
  dropHint,
  setDropHint,
  onDrop,
  missingRequired,
  usedKeys,
}: {
  title: string;
  fields: FieldDef[];
  editingFieldKey: string | null;
  editingLabel: string;
  setEditingFieldKey: (k: string | null) => void;
  setEditingLabel: (s: string) => void;
  onRename: (key: string, label: string) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
  onAddField: () => void | Promise<void>;
  dragKey: string | null;
  setDragKey: (k: string | null) => void;
  dropHint: { group: string; beforeKey?: string } | null;
  setDropHint: (v: { group: string; beforeKey?: string } | null) => void;
  onDrop: (srcKey: string, beforeKey?: string) => void;
  missingRequired: string[];
  /** Какие ключи уже расставлены в документе — для отметки «● в тексте». */
  usedKeys?: Set<string>;
}) {
  const isOver =
    dropHint?.group === title && dragKey !== null;

  return (
    <div
      className={`rounded-xl border bg-background transition ${
        isOver ? "border-primary ring-2 ring-primary/20" : "border-border/60"
      }`}
      onDragOver={(e) => {
        if (!dragKey) return;
        e.preventDefault();
        // Если курсор над пустым местом в группе (не над конкретной карточкой) —
        // подсвечиваем всю группу = drop в конец.
        setDropHint({ group: title });
      }}
      onDragLeave={(e) => {
        // Сбрасываем подсветку только если курсор реально вышел из контейнера.
        if (e.currentTarget === e.target) setDropHint(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!dragKey) return;
        const beforeKey = dropHint?.group === title ? dropHint?.beforeKey : undefined;
        onDrop(dragKey, beforeKey);
        setDragKey(null);
        setDropHint(null);
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}{" "}
          <span className="text-muted-foreground/60 normal-case font-normal">
            · {fields.length}
          </span>
        </div>
        <button
          onClick={() => onAddField()}
          className="text-[11px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
          title="Добавить поле"
        >
          <Plus className="w-3 h-3" /> поле
        </button>
      </div>

      <div className="p-1.5 space-y-1 min-h-[42px]">
        {fields.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/70 px-2 py-2">
            Пусто. Перетащи карточку сюда или нажми «+ поле».
          </div>
        ) : (
          fields.map((f) => {
            const isEditing = editingFieldKey === f.key;
            const isDragged = dragKey === f.key;
            const showLineHint =
              dropHint?.group === title && dropHint?.beforeKey === f.key && dragKey;
            return (
              <div key={f.key}>
                {showLineHint && <div className="h-0.5 bg-primary/60 rounded mx-1" />}
                <div
                  draggable={!isEditing}
                  onDragStart={(e) => {
                    setDragKey(f.key);
                    e.dataTransfer.effectAllowed = "move";
                    // Кастомный mime — чтобы редактор узнал «своего» при drop в doc
                    e.dataTransfer.setData("application/x-tpl-key", f.key);
                    // Без text/plain drag не работает в FF
                    e.dataTransfer.setData("text/plain", `{{${f.key}}}`);
                  }}
                  onDragEnd={() => {
                    setDragKey(null);
                    setDropHint(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragKey || dragKey === f.key) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDropHint({ group: title, beforeKey: f.key });
                  }}
                  className={`group/card rounded-lg px-2 py-1.5 flex items-center gap-1.5 cursor-grab active:cursor-grabbing transition ${
                    isDragged
                      ? "opacity-40 bg-muted"
                      : missingRequired.includes(f.key)
                      ? "bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30"
                      : "hover:bg-muted/60"
                  }`}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onRename(f.key, editingLabel);
                        if (e.key === "Escape") setEditingFieldKey(null);
                      }}
                      onBlur={() => onRename(f.key, editingLabel)}
                      className="text-xs flex-1 bg-card border border-primary rounded px-1.5 py-0.5 outline-none"
                    />
                  ) : (
                    <>
                      {usedKeys && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            usedKeys.has(f.key)
                              ? "bg-primary"
                              : "bg-border"
                          }`}
                          title={usedKeys.has(f.key) ? "Расставлено в документе" : "Не вставлено — перетащи в текст"}
                        />
                      )}
                      <span className="text-xs flex-1 truncate" title={`${f.label} · {{${f.key}}}`}>
                        {f.label}
                      </span>
                      <div className="opacity-0 group-hover/card:opacity-100 transition flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingFieldKey(f.key);
                            setEditingLabel(f.label);
                          }}
                          className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                          title="Переименовать"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onRemove(f.key)}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Удалить"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
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
