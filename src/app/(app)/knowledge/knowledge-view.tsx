"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Globe,
  FileText,
  Plus,
  Trash2,
  FileUp,
  Loader2,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatDate, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useBranding } from "@/components/branding-provider";
import { UsageBar } from "@/components/usage-bar";
import { getPlan, type PlanCode } from "@/lib/plans";

type Doc = {
  id: string;
  name: string;
  source_type: string;
  chunks_count: number;
  status: string;
  created_at: string;
};

type Memory = {
  id: string;
  content: string;
  kind: string;
  source: string;
  created_at: string;
};

type Stats = {
  documentsCount: number;
  chunksCount: number;
  memoriesCount: number;
  requestsUsed: number;
  plan: PlanCode;
};

const KIND_LABEL: Record<string, string> = {
  fact: "Факт",
  preference: "Предпочтение",
  agreement: "Договорённость",
  rule: "Правило",
};

export function KnowledgeView({
  initialDocuments,
  initialMemories,
  stats,
}: {
  initialDocuments: Doc[];
  initialMemories: Memory[];
  stats: Stats;
}) {
  const router = useRouter();
  const brand = useBranding();
  const [tab, setTab] = useState<"documents" | "memory">("documents");

  const plan = getPlan(stats.plan);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <header
        className="h-16 sticky top-0 z-10 glass border-b border-border/60 px-4 md:px-6 flex items-center gap-4"
      >
        <h1 className="text-lg font-semibold">База знаний</h1>
        <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
          Тариф «{plan.name}»
        </div>
      </header>

      <div className="container-page max-w-4xl py-6 md:py-8 space-y-6">
        {/* stats */}
        <section className="card-surface p-5">
          <div className="grid md:grid-cols-3 gap-4">
            <UsageBar
              label="Документы"
              used={stats.documentsCount}
              limit={plan.limits.documents}
              accent={brand.accentColor}
            />
            <UsageBar
              label="Память (фактов)"
              used={stats.memoriesCount}
              limit={plan.limits.memories}
              accent={brand.accentColor}
            />
            <UsageBar
              label="AI-запросов в этом месяце"
              used={stats.requestsUsed}
              limit={plan.limits.requests}
              accent={brand.accentColor}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Фрагментов в векторном индексе: {stats.chunksCount.toLocaleString("ru")}
          </p>
        </section>

        {/* tabs */}
        <div className="inline-flex rounded-full bg-muted p-1">
          <TabBtn active={tab === "documents"} onClick={() => setTab("documents")} accent={brand.accentColor}>
            Документы {initialDocuments.length > 0 && `(${initialDocuments.length})`}
          </TabBtn>
          <TabBtn active={tab === "memory"} onClick={() => setTab("memory")} accent={brand.accentColor}>
            Память {initialMemories.length > 0 && `(${initialMemories.length})`}
          </TabBtn>
        </div>

        {tab === "documents" ? (
          <DocumentsTab documents={initialDocuments} onChange={() => router.refresh()} />
        ) : (
          <MemoryTab memories={initialMemories} onChange={() => router.refresh()} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 h-9 rounded-full text-sm font-medium transition",
        active ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
      style={active ? { color: accent } : undefined}
    >
      {children}
    </button>
  );
}

function DocumentsTab({
  documents,
  onChange,
}: {
  documents: Doc[];
  onChange: () => void;
}) {
  const brand = useBranding();
  const [mode, setMode] = useState<null | "url" | "text">(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function ingestInline(payload: object) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setMode(null);
      setUrl("");
      setText("");
      setName("");
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    setBusy(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
      }
      setMode(null);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    const supabase = createClient();
    await supabase.from("documents").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "card-surface p-6 md:p-8 text-center transition",
          dragging && "bg-muted/40"
        )}
        style={{
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: dragging ? brand.accentColor : "hsl(var(--border))",
        }}
      >
        <FileUp className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">Перетащите файлы сюда</p>
        <p className="text-sm text-muted-foreground">PDF, DOCX, XLSX, CSV, TXT · до 25 MB</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <label className="inline-flex">
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <span
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-white text-sm"
              style={{ background: brand.accentColor }}
            >
              <Upload className="w-4 h-4" /> Выбрать файлы
            </span>
          </label>
          <Button variant="outline" onClick={() => setMode("url")}>
            <Globe className="w-4 h-4" /> URL сайта
          </Button>
          <Button variant="outline" onClick={() => setMode("text")}>
            <FileText className="w-4 h-4" /> Свой текст
          </Button>
        </div>
        {busy && (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Обработка…
          </div>
        )}
        {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
      </div>

      {mode === "url" && (
        <div className="card-surface p-5 space-y-3">
          <div className="font-medium">Добавить сайт</div>
          <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => ingestInline({ source: "url", value: url })}
              disabled={!url || busy}
            >
              {busy ? "Добавляем…" : "Добавить"}
            </Button>
          </div>
        </div>
      )}

      {mode === "text" && (
        <div className="card-surface p-5 space-y-3">
          <div className="font-medium">Добавить текст</div>
          <Input
            placeholder="Название (например, «О компании»)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Вставьте текст…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[160px]"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => ingestInline({ source: "text", value: text, name })}
              disabled={!text.trim() || busy}
            >
              {busy ? "Добавляем…" : "Добавить"}
            </Button>
          </div>
        </div>
      )}

      <div className="card-surface divide-y divide-border">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Пока нет документов. Загрузите первый — и ассистент сразу научится.
          </div>
        ) : (
          documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center">
                {iconFor(d.source_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.chunks_count} фрагментов · {formatDate(d.created_at)} ·{" "}
                  {statusLabel(d.status)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Удалить"
                onClick={() => removeDoc(d.id)}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MemoryTab({
  memories,
  onChange,
}: {
  memories: Memory[];
  onChange: () => void;
}) {
  const brand = useBranding();
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<"fact" | "preference" | "agreement" | "rule">("fact");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function create() {
    if (!draft.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), kind }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? j.error ?? "failed");
      }
      setDraft("");
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/memories?id=${id}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/memories?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editText }),
    });
    if (res.ok) {
      setEditingId(null);
      onChange();
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-surface p-5">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0"
            style={{ background: brand.accentColor }}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Добавить факт в память</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Короткое утверждение, которое ассистент будет учитывать во всех ответах.
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Например: «Мы работаем с клиентами только по безналу»"
              className="mt-3 min-h-[72px]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="h-9 rounded-xl border border-border bg-card px-3 text-sm"
              >
                {Object.entries(KIND_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => setDraft("")} disabled={busy || !draft}>
                  Очистить
                </Button>
                <Button onClick={create} disabled={busy || !draft.trim()}>
                  {busy ? "Сохраняем…" : "Добавить"}
                </Button>
              </div>
            </div>
            {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
          </div>
        </div>
      </div>

      <div className="card-surface divide-y divide-border">
        {memories.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Пока нет фактов. Ассистент извлекает их из сообщений автоматически, либо добавьте
            вручную.
          </div>
        ) : (
          memories.map((m) => (
            <div key={m.id} className="p-4 flex items-start gap-3">
              <span
                className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 h-6 text-[11px] shrink-0"
                style={{
                  background: `color-mix(in srgb, ${brand.accentColor} 12%, transparent)`,
                  color: brand.accentColor,
                }}
              >
                {KIND_LABEL[m.kind] ?? "Факт"}
              </span>
              <div className="flex-1 min-w-0">
                {editingId === m.id ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[60px]"
                  />
                ) : (
                  <div className="text-sm leading-snug break-words">{m.content}</div>
                )}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {sourceLabel(m.source)} · {formatDate(m.created_at)}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {editingId === m.id ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => saveEdit(m.id)} aria-label="Сохранить">
                      <Sparkles className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} aria-label="Отмена">
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditText(m.content);
                      }}
                      aria-label="Изменить"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m.id)} aria-label="Удалить">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function sourceLabel(s: string) {
  if (s === "chat") return "из чата";
  if (s === "document") return "из документа";
  return "вручную";
}

function iconFor(t: string) {
  if (t === "url") return <Globe className="w-4 h-4 text-muted-foreground" />;
  if (t === "manual" || t === "ai") return <Plus className="w-4 h-4 text-muted-foreground" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}
function statusLabel(s: string) {
  if (s === "ready") return "готово";
  if (s === "processing") return "обрабатывается…";
  return s;
}
