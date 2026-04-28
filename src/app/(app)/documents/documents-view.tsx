"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Copy, Plus, Trash2, FileText, Sparkles } from "lucide-react";
import { ContractGeneratorView } from "./contract-generator-view";
import { cn } from "@/lib/utils";

type Template = { id: string; name: string; body: string; created_at: string };
type Client = { id: string; name: string; contact: string | null; email: string | null; phone: string | null };

type Mode = "text" | "docx";

export function DocumentsView({ templates, clients }: { templates: Template[]; clients: Client[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const client = clients.find((c) => c.id === clientId) ?? null;

  const rendered = selected ? renderTemplate(selected.body, client) : "";

  async function saveTemplate(fd: FormData) {
    const supabase = createClient();
    await supabase.from("templates").insert({
      name: String(fd.get("name") ?? ""),
      body: String(fd.get("body") ?? ""),
    });
    setAdding(false);
    router.refresh();
  }
  async function removeTemplate(id: string) {
    const supabase = createClient();
    await supabase.from("templates").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-lg font-semibold shrink-0">Документы</h1>
          <div className="hidden sm:flex items-center gap-1 bg-muted/60 rounded-xl p-1">
            <button
              onClick={() => setMode("text")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium transition",
                mode === "text" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Текстовые шаблоны
            </button>
            <button
              onClick={() => setMode("docx")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium transition",
                mode === "docx" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Договоры (.docx)
            </button>
          </div>
        </div>
        {mode === "text" && (
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Новый шаблон</Button>
        )}
      </header>

      {/* Mobile mode switcher */}
      <div className="sm:hidden border-b border-border/60 px-4 py-2 flex gap-1 bg-muted/30">
        <button
          onClick={() => setMode("text")}
          className={cn(
            "flex-1 h-8 rounded-lg text-xs font-medium transition",
            mode === "text" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Шаблоны
        </button>
        <button
          onClick={() => setMode("docx")}
          className={cn(
            "flex-1 h-8 rounded-lg text-xs font-medium transition",
            mode === "docx" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Договоры (.docx)
        </button>
      </div>

      {mode === "docx" ? (
        <ContractGeneratorView />
      ) : (
      <div className="flex-1 overflow-hidden grid md:grid-cols-[280px_1fr]">
        {/* templates list */}
        <aside className="border-r border-border/60 overflow-y-auto md:min-h-0">
          <div className="p-3 space-y-1">
            {templates.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Нет шаблонов. Добавьте первый.</div>
            ) : templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 flex items-start gap-2 transition ${selectedId === t.id ? "bg-muted" : "hover:bg-muted/60"}`}
              >
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* preview */}
        <div className="overflow-y-auto">
          <div className="container-page max-w-3xl py-6 space-y-5">
            {adding && (
              <form action={saveTemplate} className="card-surface p-5 space-y-3">
                <div className="font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Новый шаблон</div>
                <Input name="name" placeholder="Название (например, «КП стандарт»)" required />
                <Textarea
                  name="body"
                  placeholder={"Здравствуйте, {{client.name}}!\n\nВысылаем КП по обсуждённым условиям…"}
                  className="min-h-[200px] font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">Переменные: {"{{client.name}}"}, {"{{client.contact}}"}, {"{{client.email}}"}, {"{{client.phone}}"}</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
                  <Button type="submit">Сохранить</Button>
                </div>
              </form>
            )}

            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Шаблон</div>
                    <h2 className="text-xl font-semibold">{selected.name}</h2>
                  </div>
                  <Button variant="ghost" onClick={() => removeTemplate(selected.id)}>
                    <Trash2 className="w-4 h-4" /> Удалить
                  </Button>
                </div>

                <div className="card-surface p-4">
                  <label className="text-xs text-muted-foreground">Клиент</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Без клиента</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="card-surface p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium">Превью</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(rendered)}
                    >
                      <Copy className="w-4 h-4" /> Скопировать
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{rendered}</pre>
                </div>
              </>
            ) : (
              !adding && <div className="text-sm text-muted-foreground">Выберите шаблон или создайте новый.</div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function renderTemplate(body: string, client: Client | null) {
  return body
    .replace(/\{\{client\.name\}\}/g, client?.name ?? "—")
    .replace(/\{\{client\.contact\}\}/g, client?.contact ?? "—")
    .replace(/\{\{client\.email\}\}/g, client?.email ?? "—")
    .replace(/\{\{client\.phone\}\}/g, client?.phone ?? "—")
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("ru-RU"));
}
