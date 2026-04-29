"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Copy,
  Plus,
  Trash2,
  FileText,
  Sparkles,
  ImagePlus,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { ContractGeneratorView } from "./contract-generator-view";
import { cn } from "@/lib/utils";
import { renderTextTemplate, TEMPLATE_VARIABLE_HINT } from "@/lib/template-render";

type Template = {
  id: string;
  name: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
};
type Client = {
  id: string;
  name: string;
  short_name?: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  inn?: string | null;
};

type Mode = "text" | "docx";

export function DocumentsView({
  templates: initialTemplates,
  clients,
  user,
  company,
}: {
  templates: Template[];
  clients: Client[];
  user?: { full_name: string | null; email: string | null };
  company?: { name: string | null; assistant_name: string | null };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const editTextRef = useRef<HTMLTextAreaElement>(null);

  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState(
    "Здравствуйте, {{client.greeting}}!\n\nВысылаем КП по обсуждённым условиям…\n\n— {{user.name}}"
  );
  const newTextRef = useRef<HTMLTextAreaElement>(null);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [activeEditor, setActiveEditor] = useState<"new" | "edit" | null>(null);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const client = clients.find((c) => c.id === clientId) ?? null;

  // Когда переключаем шаблон — выходим из режима правки.
  useEffect(() => {
    setEditing(false);
  }, [selectedId]);

  const previewBody = editing ? editBody : selected?.body ?? "";
  const rendered = useMemo(() => {
    if (!previewBody) return "";
    return renderTextTemplate(previewBody, {
      client: client ?? undefined,
      user,
      company,
    });
  }, [previewBody, client, user, company]);

  async function reloadTemplates(autoSelect?: string) {
    const r = await fetch("/api/templates");
    if (!r.ok) return;
    const j = (await r.json()) as { templates: Template[] };
    setTemplates(j.templates);
    if (autoSelect) setSelectedId(autoSelect);
  }

  async function saveNew() {
    if (!newName.trim() || !newBody.trim()) return;
    setSavingTpl(true);
    try {
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), body: newBody }),
      });
      if (r.ok) {
        const j = await r.json();
        setAdding(false);
        setNewName("");
        setNewBody(
          "Здравствуйте, {{client.greeting}}!\n\nВысылаем КП по обсуждённым условиям…\n\n— {{user.name}}"
        );
        await reloadTemplates(j.template.id);
      } else {
        alert("Не удалось сохранить: " + (await r.text()));
      }
    } finally {
      setSavingTpl(false);
    }
  }

  async function saveEdits() {
    if (!selected) return;
    if (!editName.trim() || !editBody.trim()) return;
    setSavingTpl(true);
    try {
      const r = await fetch(`/api/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), body: editBody }),
      });
      if (r.ok) {
        const j = await r.json();
        setTemplates((t) => t.map((x) => (x.id === selected.id ? j.template : x)));
        setEditing(false);
      } else {
        alert("Не удалось сохранить: " + (await r.text()));
      }
    } finally {
      setSavingTpl(false);
    }
  }

  async function removeTemplate(id: string) {
    if (!confirm("Удалить шаблон?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates((t) => t.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    router.refresh();
  }

  function startEdit() {
    if (!selected) return;
    setEditName(selected.name);
    setEditBody(selected.body);
    setEditing(true);
    setActiveEditor("edit");
  }

  /** Загрузка картинки в bucket template-images и вставка markdown-ссылки
   *  в активный textarea (новый шаблон или редактируемый). */
  async function uploadImage(file: File) {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/templates/upload-image", { method: "POST", body: fd });
      if (!r.ok) {
        alert("Не удалось загрузить: " + (await r.text()));
        return;
      }
      const j = (await r.json()) as { url: string; name: string };
      const md = `\n\n![${j.name}](${j.url})\n\n`;

      const setter = activeEditor === "edit" ? setEditBody : setNewBody;
      const ref = activeEditor === "edit" ? editTextRef : newTextRef;
      const current = activeEditor === "edit" ? editBody : newBody;
      const ta = ref.current;
      if (ta) {
        const start = ta.selectionStart ?? current.length;
        const end = ta.selectionEnd ?? current.length;
        const next = current.slice(0, start) + md + current.slice(end);
        setter(next);
        // вернуть курсор после вставленного
        requestAnimationFrame(() => {
          ta.focus();
          const pos = start + md.length;
          ta.setSelectionRange(pos, pos);
        });
      } else {
        setter(current + md);
      }
    } finally {
      setUploadingImg(false);
    }
  }

  function insertVariable(key: string) {
    const ph = `{{${key}}}`;
    const setter = activeEditor === "edit" ? setEditBody : setNewBody;
    const ref = activeEditor === "edit" ? editTextRef : newTextRef;
    const current = activeEditor === "edit" ? editBody : newBody;
    const ta = ref.current;
    if (ta) {
      const start = ta.selectionStart ?? current.length;
      const end = ta.selectionEnd ?? current.length;
      const next = current.slice(0, start) + ph + current.slice(end);
      setter(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + ph.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setter(current + ph);
    }
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
        {mode === "text" && !adding && (
          <Button
            size="sm"
            onClick={() => {
              setAdding(true);
              setActiveEditor("new");
            }}
          >
            <Plus className="w-4 h-4" /> Новый шаблон
          </Button>
        )}
      </header>

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
          <aside className="border-r border-border/60 overflow-y-auto md:min-h-0">
            <div className="p-3 space-y-1">
              {templates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Нет шаблонов. Добавьте первый или попросите ассистента — он умеет создавать.
                </div>
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
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="overflow-y-auto">
            <div className="container-page max-w-3xl py-6 space-y-5">
              {/* Hidden input для загрузки картинок — общий для нового и редактируемого. */}
              <input
                ref={imgInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                  e.target.value = "";
                }}
              />

              {adding && (
                <div className="card-surface p-5 space-y-3">
                  <div className="font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Новый шаблон
                  </div>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder='Название (например, «КП стандарт»)'
                  />
                  <Textarea
                    ref={newTextRef}
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    onFocus={() => setActiveEditor("new")}
                    placeholder="Здравствуйте, {{client.greeting}}!"
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <EditorToolbar
                    onPickImage={() => {
                      setActiveEditor("new");
                      imgInputRef.current?.click();
                    }}
                    onInsertVariable={(k) => {
                      setActiveEditor("new");
                      insertVariable(k);
                    }}
                    uploading={uploadingImg && activeEditor === "new"}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAdding(false);
                        setActiveEditor(null);
                      }}
                    >
                      Отмена
                    </Button>
                    <Button onClick={saveNew} disabled={savingTpl || !newName.trim() || !newBody.trim()}>
                      {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Сохранить
                    </Button>
                  </div>
                </div>
              )}

              {selected ? (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Шаблон</div>
                      {editing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-xl font-semibold mt-1"
                        />
                      ) : (
                        <h2 className="text-xl font-semibold truncate">{selected.name}</h2>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editing ? (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => setEditing(false)}
                            disabled={savingTpl}
                          >
                            <X className="w-4 h-4" /> Отмена
                          </Button>
                          <Button onClick={saveEdits} disabled={savingTpl}>
                            {savingTpl ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Сохранить
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={startEdit}>
                            <Pencil className="w-4 h-4" /> Редактировать
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTemplate(selected.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Удалить
                          </Button>
                        </>
                      )}
                    </div>
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
                        <option key={c.id} value={c.id}>
                          {c.short_name || c.name}
                          {c.contact ? ` — ${c.contact}` : ""}
                        </option>
                      ))}
                    </select>
                    {client && (
                      <div className="mt-2 text-[12px] text-muted-foreground">
                        В приветствии будет:{" "}
                        <b className="text-foreground">
                          {renderTextTemplate("{{client.greeting}}", { client })}
                        </b>{" "}
                        — взято из «контактного лица», если оно заполнено, иначе из названия компании.
                      </div>
                    )}
                  </div>

                  {editing && (
                    <div className="card-surface p-4 space-y-3">
                      <div className="text-sm font-medium">Текст шаблона</div>
                      <Textarea
                        ref={editTextRef}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        onFocus={() => setActiveEditor("edit")}
                        className="min-h-[260px] font-mono text-sm"
                      />
                      <EditorToolbar
                        onPickImage={() => {
                          setActiveEditor("edit");
                          imgInputRef.current?.click();
                        }}
                        onInsertVariable={(k) => {
                          setActiveEditor("edit");
                          insertVariable(k);
                        }}
                        uploading={uploadingImg && activeEditor === "edit"}
                      />
                    </div>
                  )}

                  <div className="card-surface p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium">Превью</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(rendered)}
                      >
                        <Copy className="w-4 h-4" /> Скопировать текст
                      </Button>
                    </div>
                    <article className="prose prose-sm max-w-none whitespace-pre-wrap [&_img]:rounded-lg [&_img]:my-2">
                      <ReactMarkdown>{rendered}</ReactMarkdown>
                    </article>
                  </div>
                </>
              ) : (
                !adding && (
                  <div className="text-sm text-muted-foreground">
                    Выберите шаблон или создайте новый.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorToolbar({
  onPickImage,
  onInsertVariable,
  uploading,
}: {
  onPickImage: () => void;
  onInsertVariable: (k: string) => void;
  uploading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button type="button" variant="outline" size="sm" onClick={onPickImage} disabled={uploading}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        Картинка
      </Button>
      <details className="relative">
        <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted">
          <Sparkles className="w-3.5 h-3.5" /> Переменные
        </summary>
        <div className="absolute z-20 mt-2 right-0 w-[320px] rounded-xl border border-border bg-card shadow-lg p-2 max-h-[60vh] overflow-y-auto">
          {TEMPLATE_VARIABLE_HINT.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => onInsertVariable(v.key)}
              className="w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-xs"
            >
              <code className="text-primary shrink-0">{`{{${v.key}}}`}</code>
              <span className="text-muted-foreground">{v.label}</span>
            </button>
          ))}
        </div>
      </details>
      <span className="text-[11px] text-muted-foreground">
        Поддерживается markdown: **жирный**, ## заголовки, списки, картинки, ссылки.
      </span>
    </div>
  );
}
