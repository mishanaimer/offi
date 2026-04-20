"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe, FileText, Plus, Trash2, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Doc = { id: string; name: string; source_type: string; chunks_count: number; status: string; created_at: string };

export function KnowledgeView({ initialDocuments }: { initialDocuments: Doc[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "url" | "text" | "file">(null);
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
      router.refresh();
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
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    const supabase = createClient();
    await supabase.from("documents").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center">
        <h1 className="text-lg font-semibold">База знаний</h1>
      </header>

      <div className="container-page max-w-4xl py-6 md:py-10 space-y-6">
        {/* Add section */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
          }}
          className={`card-surface p-6 md:p-8 text-center border-dashed transition ${dragging ? "border-primary bg-primary/5" : ""}`}
          style={{ borderStyle: "dashed", borderWidth: 2 }}
        >
          <FileUp className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">Перетащите файлы сюда</p>
          <p className="text-sm text-muted-foreground">PDF, DOCX, XLSX, CSV, TXT · до 25 MB</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <label>
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
              <span className="btn-accent cursor-pointer"><Upload className="w-4 h-4" /> Выбрать файлы</span>
            </label>
            <Button variant="outline" onClick={() => setMode("url")}><Globe className="w-4 h-4" /> URL сайта</Button>
            <Button variant="outline" onClick={() => setMode("text")}><FileText className="w-4 h-4" /> Свой текст</Button>
          </div>
          {busy && <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Обработка…</div>}
          {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
        </div>

        {mode === "url" && (
          <div className="card-surface p-5 space-y-3">
            <div className="font-medium">Добавить сайт</div>
            <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode(null)}>Отмена</Button>
              <Button onClick={() => ingestInline({ source: "url", value: url })} disabled={!url || busy}>
                {busy ? "Добавляем…" : "Добавить"}
              </Button>
            </div>
          </div>
        )}

        {mode === "text" && (
          <div className="card-surface p-5 space-y-3">
            <div className="font-medium">Добавить текст</div>
            <Input placeholder="Название (например, «О компании»)" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Вставьте текст…" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[160px]" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode(null)}>Отмена</Button>
              <Button onClick={() => ingestInline({ source: "text", value: text, name })} disabled={!text.trim() || busy}>
                {busy ? "Добавляем…" : "Добавить"}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="card-surface divide-y divide-border">
          {initialDocuments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Пока нет документов. Загрузите первый — и ассистент сразу научится.</div>
          ) : (
            initialDocuments.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center">
                  {iconFor(d.source_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.chunks_count} фрагментов · {formatDate(d.created_at)} · {statusLabel(d.status)}
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Удалить" onClick={() => removeDoc(d.id)}>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
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
