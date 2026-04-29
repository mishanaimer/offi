"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User as UserIcon,
  FileText,
  Paperclip,
  Plus,
  Save,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Brain,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

type ClientFull = {
  id: string;
  name: string;
  short_name: string | null;
  legal_name: string | null;
  client_type: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  website: string | null;
  industry: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  bank_name: string | null;
  bank_account: string | null;
  corr_account: string | null;
  bik: string | null;
  legal_address: string | null;
  actual_address: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  signatory_basis: string | null;
  status: string;
  tags: string[] | null;
  summary: string | null;
};

type Note = { id: string; content: string; source: string; created_at: string };
type FileItem = {
  id: string;
  name: string;
  size_bytes: number | null;
  mime: string | null;
  kind: string | null;
  storage_path: string;
  created_at: string;
};
type Contract = {
  id: string;
  template_id: string | null;
  template_name: string | null;
  name: string | null;
  storage_path: string | null;
  download_url: string | null;
  warnings: string[] | null;
  created_at: string;
};
type Memory = { id: string; content: string; kind: string; created_at: string };
type Template = { id: string; name: string; description: string | null };

const STATUS_OPTIONS = [
  { v: "lead", label: "Лид" },
  { v: "active", label: "Активный" },
  { v: "partner", label: "Партнёр" },
  { v: "archived", label: "Архив" },
];

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{ key: keyof ClientFull; label: string; placeholder?: string; type?: "text" | "textarea" }>;
}> = [
  {
    title: "Контакты",
    fields: [
      { key: "contact", label: "Контактное лицо" },
      { key: "phone", label: "Телефон" },
      { key: "email", label: "Email" },
      { key: "telegram", label: "Telegram" },
      { key: "website", label: "Сайт" },
      { key: "industry", label: "Отрасль" },
    ],
  },
  {
    title: "Юридические данные",
    fields: [
      { key: "legal_name", label: "Полное наименование" },
      { key: "short_name", label: "Краткое наименование" },
      { key: "inn", label: "ИНН" },
      { key: "kpp", label: "КПП" },
      { key: "ogrn", label: "ОГРН" },
      { key: "legal_address", label: "Юридический адрес", type: "textarea" },
      { key: "actual_address", label: "Фактический адрес", type: "textarea" },
    ],
  },
  {
    title: "Банк",
    fields: [
      { key: "bank_name", label: "Название банка" },
      { key: "bank_account", label: "Расчётный счёт" },
      { key: "corr_account", label: "Корр. счёт" },
      { key: "bik", label: "БИК" },
    ],
  },
  {
    title: "Подписант",
    fields: [
      { key: "signatory_name", label: "ФИО подписанта", placeholder: "Иванов Иван Иванович" },
      { key: "signatory_title", label: "Должность", placeholder: "Генеральный директор" },
      { key: "signatory_basis", label: "Действует на основании", placeholder: "Устава" },
    ],
  },
];

export function ClientDetailView({
  client: initialClient,
  initialNotes,
  initialFiles,
  initialContracts,
  initialMemories,
  templates,
}: {
  client: ClientFull;
  initialNotes: Note[];
  initialFiles: FileItem[];
  initialContracts: Contract[];
  initialMemories: Memory[];
  templates: Template[];
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [draft, setDraft] = useState<ClientFull>(initialClient);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [, startTransition] = useTransition();

  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);

  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [memories] = useState<Memory[]>(initialMemories);

  const [genOpen, setGenOpen] = useState(false);
  const [genTemplateId, setGenTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [genName, setGenName] = useState("");
  const [genVars, setGenVars] = useState<string>("");
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function update<K extends keyof ClientFull>(key: K, value: ClientFull[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const k of Object.keys(draft) as (keyof ClientFull)[]) {
        if ((draft as any)[k] !== (client as any)[k]) payload[k] = (draft as any)[k];
      }
      if (Object.keys(payload).length === 0) {
        setDirty(false);
        return;
      }
      const r = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        alert("Ошибка сохранения: " + (await r.text()));
        return;
      }
      const j = await r.json();
      setClient(j.client);
      setDraft(j.client);
      setDirty(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    const next = Array.from(new Set([...(draft.tags ?? []), t]));
    update("tags", next);
    setTagInput("");
  }
  function removeTag(t: string) {
    update("tags", (draft.tags ?? []).filter((x) => x !== t));
  }

  async function addNote() {
    const content = newNote.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      const r = await fetch(`/api/clients/${client.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (r.ok) {
        const j = await r.json();
        setNotes((n) => [j.note, ...n]);
        setNewNote("");
      }
    } finally {
      setSavingNote(false);
    }
  }
  async function deleteNote(id: string) {
    await fetch(`/api/clients/${client.id}/notes?noteId=${id}`, { method: "DELETE" });
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  async function uploadFile(file: File, kind: string = "other") {
    setUploadingFile(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const r = await fetch(`/api/clients/${client.id}/files`, {
        method: "POST",
        body: fd,
      });
      if (r.ok) {
        const j = await r.json();
        setFiles((f) => [j.file, ...f]);
      } else {
        alert("Не удалось загрузить: " + (await r.text()));
      }
    } finally {
      setUploadingFile(null);
    }
  }
  async function downloadFile(f: FileItem) {
    const r = await fetch(`/api/clients/${client.id}/files/${f.id}`);
    if (!r.ok) return;
    const j = await r.json();
    window.open(j.url, "_blank");
  }
  async function deleteFile(f: FileItem) {
    if (!confirm(`Удалить «${f.name}»?`)) return;
    await fetch(`/api/clients/${client.id}/files/${f.id}`, { method: "DELETE" });
    setFiles((files) => files.filter((x) => x.id !== f.id));
  }

  async function generateContract() {
    setGenerating(true);
    setGenStatus(null);
    try {
      let variables: Record<string, string> = {};
      if (genVars.trim()) {
        try {
          variables = JSON.parse(genVars);
        } catch {
          // допускаем простой формат key=value на каждой строке
          for (const line of genVars.split("\n")) {
            const m = line.match(/^\s*([\w-]+)\s*[:=]\s*(.+)$/);
            if (m) variables[m[1]] = m[2].trim();
          }
        }
      }
      const r = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai_create_contract",
          confirmed: true,
          params: {
            template_id: genTemplateId || undefined,
            client_id: client.id,
            name: genName || undefined,
            variables,
          },
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setGenStatus("Ошибка: " + (j.error ?? "не удалось сгенерировать"));
      } else {
        setGenStatus(`✓ Готово: ${j.name}`);
        setContracts((c) => [
          {
            id: j.contract_id,
            template_id: genTemplateId || null,
            template_name: j.template_name ?? null,
            name: j.name,
            storage_path: null,
            download_url: j.download_url,
            warnings: j.warnings ?? null,
            created_at: new Date().toISOString(),
          },
          ...c,
        ]);
        if (j.download_url) window.open(j.download_url, "_blank");
        setGenOpen(false);
        setGenName("");
        setGenVars("");
      }
    } finally {
      setGenerating(false);
    }
  }

  const isLegal = draft.client_type !== "individual";
  const headerName = draft.short_name || draft.name;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/clients" className="p-2 rounded-lg hover:bg-muted shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            {isLegal ? <Building2 className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Клиент
            </div>
            <h1 className="text-lg font-semibold truncate">{headerName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={draft.status}
            onChange={(e) => update("status", e.target.value as any)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={saveAll}
            disabled={!dirty || saving}
            className="min-w-[120px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
        </div>
      </header>

      <div className="container-page max-w-6xl py-6 md:py-8 space-y-6">
        {/* Summary + tags */}
        <section className="card-surface p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Название (как зовём)
              </label>
              <Input
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Например, «Ромашка»"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Тип
              </label>
              <select
                value={draft.client_type ?? "legal"}
                onChange={(e) => update("client_type", e.target.value as any)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="legal">Юридическое лицо</option>
                <option value="individual">Физическое лицо</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Краткая выжимка
            </label>
            <Textarea
              value={draft.summary ?? ""}
              onChange={(e) => update("summary", e.target.value)}
              placeholder="1–2 предложения: чем занимается клиент, что для нас важно. Ассистент использует это в чате."
              className="min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TagIcon className="w-3 h-3" /> Теги
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
              {(draft.tags ?? []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px]"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="+тег"
                className="h-7 px-2 text-xs rounded-full bg-muted/40 border border-dashed border-muted-foreground/30 outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* Field groups */}
        <section className="grid lg:grid-cols-2 gap-4">
          {FIELD_GROUPS.map((g) => (
            <div key={g.title} className="card-surface p-5 space-y-3">
              <div className="font-semibold">{g.title}</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {g.fields.map((f) => (
                  <div key={f.key} className={cn(f.type === "textarea" && "sm:col-span-2")}>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </label>
                    {f.type === "textarea" ? (
                      <Textarea
                        value={(draft[f.key] as string) ?? ""}
                        onChange={(e) => update(f.key, e.target.value as any)}
                        placeholder={f.placeholder}
                        className="min-h-[64px]"
                      />
                    ) : (
                      <Input
                        value={(draft[f.key] as string) ?? ""}
                        onChange={(e) => update(f.key, e.target.value as any)}
                        placeholder={f.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Contracts */}
        <section className="card-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" /> Договоры ({contracts.length})
            </div>
            <Button size="sm" onClick={() => setGenOpen((v) => !v)}>
              <Plus className="w-4 h-4" /> Сгенерировать договор
            </Button>
          </div>

          {genOpen && (
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/30">
              {templates.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Шаблонов пока нет.{" "}
                  <Link href="/documents" className="underline">
                    Загрузите .docx
                  </Link>{" "}
                  в раздел Документы → Договоры.
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Шаблон
                    </label>
                    <select
                      value={genTemplateId}
                      onChange={(e) => setGenTemplateId(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      value={genName}
                      onChange={(e) => setGenName(e.target.value)}
                      placeholder="Имя файла (опционально)"
                    />
                  </div>
                  <Textarea
                    value={genVars}
                    onChange={(e) => setGenVars(e.target.value)}
                    placeholder={
                      "Доп. поля шаблона (по строке: key=value):\nservice_subject=Разработка сайта\ncontract_number=2026/04-12"
                    }
                    className="min-h-[100px] font-mono text-xs"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Реквизиты клиента (ИНН/КПП/банк/подписант) подставятся автоматически из карточки.
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setGenOpen(false)}>
                        Отмена
                      </Button>
                      <Button size="sm" onClick={generateContract} disabled={generating}>
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Сгенерировать
                      </Button>
                    </div>
                  </div>
                  {genStatus && (
                    <div
                      className={cn(
                        "text-xs",
                        genStatus.startsWith("✓") ? "text-emerald-700" : "text-destructive"
                      )}
                    >
                      {genStatus}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {contracts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Пока ни одного договора. Сгенерируй первый — реквизиты возьмутся из карточки.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {contracts.map((c) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name ?? "Договор"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.template_name ? `шаблон «${c.template_name}» · ` : ""}
                      {formatDate(c.created_at)}
                      {c.warnings && c.warnings.length > 0 && (
                        <span className="ml-2 text-amber-700">
                          ⚠ {c.warnings.length} предупреждений
                        </span>
                      )}
                    </div>
                  </div>
                  {c.download_url && (
                    <a
                      href={c.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Скачать
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="card-surface p-5 space-y-3">
          <div className="font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4" /> Заметки и история
          </div>
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Что обсуждали? Что договорились? Эту запись увидит ассистент."
              className="min-h-[70px]"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Добавить
              </Button>
            </div>
          </div>
          {notes.length > 0 && (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="whitespace-pre-wrap">{n.content}</div>
                    <button
                      onClick={() => deleteNote(n.id)}
                      className="opacity-50 hover:opacity-100"
                      aria-label="Удалить заметку"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {n.source} · {formatDate(n.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {memories.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Долгосрочная память по клиенту ({memories.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {memories.map((m) => (
                  <li key={m.id} className="rounded-lg bg-primary/5 p-2 text-[13px]">
                    <span className="text-[10px] uppercase tracking-wider text-primary mr-2">
                      {m.kind}
                    </span>
                    {m.content}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Files */}
        <section className="card-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Файлы ({files.length})
            </div>
            <label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
              />
              <span className="inline-flex h-9 px-3 items-center gap-1.5 rounded-full border border-border text-sm cursor-pointer hover:bg-muted">
                <Plus className="w-4 h-4" /> Загрузить
              </span>
            </label>
          </div>
          {uploadingFile && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Загружаем «{uploadingFile}»…
            </div>
          )}
          {files.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Карточки клиента, акты, скан паспорта — всё хранится здесь.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id} className="py-2.5 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.kind ?? "other"} · {formatBytes(f.size_bytes)} · {formatDate(f.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadFile(f)}
                    className="text-primary text-xs inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Открыть
                  </button>
                  <button
                    onClick={() => deleteFile(f)}
                    className="opacity-50 hover:opacity-100"
                    aria-label="Удалить файл"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function formatBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / (1024 * 1024)).toFixed(1)} МБ`;
}
