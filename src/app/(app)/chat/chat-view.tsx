"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Paperclip, Plus, FileText, X, Loader2, Check, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { useBranding } from "@/components/branding-provider";
import { MascotAvatar } from "@/components/mascot";
import { bucket } from "@/lib/plans";
import Link from "next/link";
import { useApiHealth } from "@/components/api-health";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

type Attachment = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "ready" | "error";
  error?: string;
};

type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status?: "pending" | "running" | "done" | "error";
  result?: any;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ document_id: string; snippet: string; name?: string }>;
  created_at?: string;
  streaming?: boolean;
  toolCalls?: ToolCall[];
};

const DEFAULT_SUGGESTIONS = [
  "Кто наши клиенты?",
  "Составь договор",
  "Что мы предлагаем?",
  "Сделай резюме базы знаний",
];

export function ChatView({
  channelId,
  initialMessages,
  suggestions = DEFAULT_SUGGESTIONS,
  quota,
}: {
  channelId: string | null;
  initialMessages: Array<{
    id: string;
    user_id: string | null;
    content: string;
    is_ai: boolean;
    created_at: string;
    sources?: any;
  }>;
  suggestions?: string[];
  quota?: { used: number; limit: number; planName: string };
}) {
  const brand = useBranding();
  const router = useRouter();
  const { recordSuccess, recordFailure } = useApiHealth();
  const [creatingSession, setCreatingSession] = useState(false);

  const [messages, setMessages] = useState<Msg[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.is_ai ? "assistant" : "user",
      content: m.content,
      sources: m.sources ?? undefined,
      created_at: m.created_at,
    }))
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stuckToBottomRef = useRef(true);

  // Отслеживаем, находится ли пользователь у самого низа
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const d = el.scrollHeight - el.clientHeight - el.scrollTop;
      stuckToBottomRef.current = d < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Авто-скролл — только если пользователь уже внизу
  useLayoutEffect(() => {
    if (!stuckToBottomRef.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Авто-рост textarea (до 6 строк)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const line = 22; // ~15px font, 1.5 leading
    const max = line * 6 + 16;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [input]);

  // Realtime: подхватываем AI-ответ, если он пишется в БД на сервере,
  // пока пользователь был на другой вкладке. Сервер сохраняет прогрессивно
  // (см. /api/chat), так что UPDATE-события докручивают контент.
  useEffect(() => {
    if (!channelId) return;
    const supabase = createBrowserClient();
    const sub = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMessages((m) => {
            if (m.some((x) => x.id === row.id)) return m;
            // Если есть streaming-плейсхолдер ассистента — «усыновляем» его DB-id,
            // чтобы последующие UPDATE применялись по правильному ключу.
            if (row.is_ai) {
              const idx = m.findIndex((x) => x.streaming && x.role === "assistant");
              if (idx >= 0) {
                const next = [...m];
                next[idx] = {
                  ...next[idx],
                  id: row.id,
                  content: next[idx].content || row.content || "",
                  sources: next[idx].sources ?? row.sources ?? undefined,
                };
                return next;
              }
            } else {
              // User-сообщение: локальное добавляется мгновенно с клиентским UUID.
              // Совпадает по content — перевешиваем на DB id.
              for (let i = m.length - 1; i >= 0; i--) {
                const msg = m[i];
                if (msg.role === "user" && msg.content === row.content && msg.id !== row.id) {
                  const next = [...m];
                  next[i] = { ...msg, id: row.id, created_at: row.created_at };
                  return next;
                }
              }
            }
            return [
              ...m,
              {
                id: row.id,
                role: row.is_ai ? "assistant" : "user",
                content: row.content,
                sources: row.sources ?? undefined,
                created_at: row.created_at,
              },
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMessages((m) =>
            m.map((x) =>
              x.id === row.id
                ? {
                    ...x,
                    content: row.content ?? x.content,
                    sources: row.sources ?? x.sources,
                  }
                : x
            )
          );
        }
      )
      .subscribe();
    return () => {
      sub.unsubscribe();
    };
  }, [channelId]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const file of arr) {
      const id = crypto.randomUUID();
      setAttachments((a) => [...a, { id, name: file.name, size: file.size, status: "uploading" }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail?.slice(0, 160) || `HTTP ${res.status}`);
        }
        setAttachments((a) => a.map((x) => (x.id === id ? { ...x, status: "ready" } : x)));
      } catch (e) {
        setAttachments((a) =>
          a.map((x) =>
            x.id === id ? { ...x, status: "error", error: (e as Error).message } : x
          )
        );
      }
    }
  }

  function removeAttachment(id: string) {
    setAttachments((a) => a.filter((x) => x.id !== id));
  }

  async function runToolCall(msgId: string, call: ToolCall) {
    setMessages((m) =>
      m.map((msg) =>
        msg.id === msgId
          ? {
              ...msg,
              toolCalls: msg.toolCalls?.map((c) =>
                c.id === call.id ? { ...c, status: "running" } : c
              ),
            }
          : msg
      )
    );
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: call.name,
          params: call.arguments,
          confirmed: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setMessages((m) =>
        m.map((msg) =>
          msg.id === msgId
            ? {
                ...msg,
                toolCalls: msg.toolCalls?.map((c) =>
                  c.id === call.id
                    ? {
                        ...c,
                        status: data?.ok ? "done" : "error",
                        result: data,
                      }
                    : c
                ),
              }
            : msg
        )
      );
    } catch (e) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === msgId
            ? {
                ...msg,
                toolCalls: msg.toolCalls?.map((c) =>
                  c.id === call.id
                    ? { ...c, status: "error", result: { error: (e as Error).message } }
                    : c
                ),
              }
            : msg
        )
      );
    }
  }

  async function send(text: string) {
    // разрешаем отправку если есть хотя бы готовое вложение, даже с пустым текстом
    const readyFiles = attachments.filter((a) => a.status === "ready");
    if ((!text.trim() && readyFiles.length === 0) || sending) return;
    // если есть ещё грузящиеся файлы — подождём
    if (attachments.some((a) => a.status === "uploading")) return;

    setSending(true);
    setInput("");
    stuckToBottomRef.current = true;

    // Добавляем в текст пользователя упоминание приложенных файлов.
    // Контент файлов уже в pgvector через /api/upload → RAG подхватит.
    const filesNote =
      readyFiles.length > 0
        ? `\n\n[Прикреплённые файлы: ${readyFiles.map((f) => f.name).join(", ")}]`
        : "";
    const effective = (text.trim() || "Разобрать приложенные файлы") + filesNote;

    const displayContent =
      readyFiles.length > 0
        ? `${text.trim()}${text.trim() ? "\n" : ""}📎 ${readyFiles.map((f) => f.name).join(", ")}`.trim()
        : text;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    const pendingAi: Msg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((m) => [...m, userMsg, pendingAi]);
    // очищаем чипы после отправки (файлы остаются в базе знаний)
    setAttachments([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          message: effective,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        let detail = `HTTP ${res.status}`;
        try {
          if (ct.includes("application/json")) {
            const j = await res.json();
            detail = [j.detail, j.hint].filter(Boolean).join(" — ") || detail;
          } else {
            detail = (await res.text()).slice(0, 300) || detail;
          }
        } catch {}
        // 402 limit_exceeded — это бизнес-лимит, не технический сбой
        if (res.status !== 402) recordFailure();
        throw new Error(detail);
      }
      if (!res.body) {
        recordFailure();
        throw new Error("stream is empty");
      }
      recordSuccess();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let sources: Msg["sources"] | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "sources") sources = evt.sources;
            else if (evt.type === "delta") {
              acc += evt.text;
              setMessages((m) =>
                m.map((msg) => (msg.id === pendingAi.id ? { ...msg, content: acc, sources } : msg))
              );
            } else if (evt.type === "tool_calls" && Array.isArray(evt.calls)) {
              const calls: ToolCall[] = evt.calls.map((c: any) => ({
                id: c.id,
                name: c.name,
                arguments: c.arguments ?? {},
                status: "pending",
              }));
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === pendingAi.id ? { ...msg, toolCalls: calls } : msg
                )
              );
            }
          } catch {}
        }
      }
      setMessages((m) =>
        m.map((msg) => (msg.id === pendingAi.id ? { ...msg, streaming: false } : msg))
      );
    } catch (e) {
      const detail = (e as Error).message || "unknown";
      // recordFailure уже вызван для known branches; для сетевых фейлов — зафиксируем тут
      if (!/HTTP\s4\d{2}/.test(detail)) recordFailure();
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingAi.id ? { ...msg, streaming: false, content: `❗ Ошибка: ${detail}` } : msg
        )
      );
    } finally {
      setSending(false);
      // вернуть фокус, чтобы можно было сразу писать дальше
      textareaRef.current?.focus();
    }
  }

  const empty = messages.length === 0;
  const quotaBucket = quota ? bucket(quota.used, quota.limit) : null;
  const quotaBlocked = !!quotaBucket?.block;
  const anyUploading = attachments.some((a) => a.status === "uploading");
  const anyReady = attachments.some((a) => a.status === "ready");
  const canSend =
    (input.trim().length > 0 || anyReady) && !sending && !quotaBlocked && !anyUploading;

  const promptBorder = useMemo(
    () => ({ borderColor: `color-mix(in srgb, ${brand.accentColor} 15%, transparent)` }),
    [brand.accentColor]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full">
      {/* header */}
      <header
        className="h-14 shrink-0 glass border-b border-border/60 px-3 md:px-6 flex items-center justify-between sticky top-0 z-10"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MascotAvatar state={sending ? "working" : "idle"} animated={sending} size={32} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight truncate">{brand.assistantName}</div>
            <div className="text-[11px] text-muted-foreground leading-tight truncate">{brand.companyName}</div>
          </div>
        </div>
        <button
          type="button"
          disabled={creatingSession}
          onClick={async () => {
            if (creatingSession) return;
            setCreatingSession(true);
            try {
              const res = await fetch("/api/chat/new-session", { method: "POST" });
              if (res.ok) {
                setMessages([]);
                setAttachments([]);
                router.refresh();
              }
            } catch {}
            finally { setCreatingSession(false); }
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 h-9 text-[13px] hover:bg-muted transition disabled:opacity-60"
          aria-label="Новый чат"
        >
          {creatingSession ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Новый
        </button>
      </header>

      {/* quota banner */}
      {quotaBucket && (quotaBucket.warn || quotaBucket.block) && (
        <div
          className={cn(
            "shrink-0 px-3 md:px-6 py-2 text-[13px] flex items-center justify-between gap-3",
            quotaBucket.block
              ? "bg-destructive/10 text-destructive"
              : "bg-[#F59E0B]/10 text-[#B45309]"
          )}
        >
          <span>
            {quotaBucket.block ? (
              <>Лимит AI-запросов исчерпан ({quotaBucket.used}/{quotaBucket.limit}) по тарифу «{quota!.planName}».</>
            ) : (
              <>Использовано {quotaBucket.percent}% лимита запросов ({quotaBucket.used}/{quotaBucket.limit}).</>
            )}
          </span>
          <Link
            href="/settings/plans"
            className="underline underline-offset-2 font-medium shrink-0"
          >
            Сменить тариф
          </Link>
        </div>
      )}

      {/* messages */}
      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-3xl px-3 md:px-6 py-6">
          {empty ? (
            <EmptyState
              welcome={brand.welcomeMessage}
              suggestions={suggestions}
              onPick={(t) => send(t)}
            />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} onRunTool={(c) => runToolCall(m.id, c)} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* composer */}
      <div
        className="shrink-0 bg-background/95 backdrop-blur border-t border-border/60 px-3 md:px-6 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="mx-auto w-full max-w-3xl">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <AttachmentChip key={a.id} a={a} onRemove={() => removeAttachment(a.id)} />
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl bg-white border p-2.5 shadow-sm"
            style={promptBorder}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:bg-muted transition shrink-0 disabled:opacity-50"
              aria-label="Прикрепить файл"
              title="Прикрепить файл (PDF, DOCX, TXT, CSV)"
              disabled={quotaBlocked || sending}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              disabled={quotaBlocked}
              placeholder={
                quotaBlocked
                  ? "Лимит запросов исчерпан — перейдите на следующий тариф"
                  : `Спросите ${brand.assistantName} что-нибудь…`
              }
              className="flex-1 resize-none bg-transparent outline-none px-1.5 py-1.5 text-[16px] md:text-[15px] leading-[1.5] max-h-[160px] disabled:opacity-60"
              style={{ minHeight: 34 }}
            />

            <button
              type="submit"
              disabled={!canSend}
              className={cn(
                "w-[34px] h-[34px] rounded-full grid place-items-center text-white transition shrink-0",
                canSend ? "opacity-100" : "opacity-100 text-muted-foreground"
              )}
              style={{
                background: canSend ? brand.accentColor : "#e8e8e8",
              }}
              aria-label="Отправить"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            {brand.assistantName} может ошибаться. Проверяйте важные факты.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onRunTool }: { msg: Msg; onRunTool?: (c: ToolCall) => void }) {
  const brand = useBranding();
  const isAi = msg.role === "assistant";

  if (isAi) {
    const hasText = !!msg.content && msg.content.trim().length > 0;
    const hasTools = !!msg.toolCalls && msg.toolCalls.length > 0;
    return (
      <div className="flex gap-2.5 animate-fade-in">
        <MascotAvatar
          state={msg.streaming ? "working" : "idle"}
          animated={!!msg.streaming}
          size={32}
        />
        <div className="max-w-[85%] space-y-1.5">
          {(hasText || !hasTools) && (
            <div
              className="inline-block px-4 py-2.5 text-[15px] leading-relaxed bg-[#f5f5f5] text-[#0a0a0a]"
              style={{ borderRadius: "18px 18px 18px 4px" }}
            >
              {msg.content ? (
                <div className="prose prose-sm max-w-none [&>p]:my-1 [&>ul]:my-2">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <TypingDots color={brand.assistantColor} />
              )}
            </div>
          )}
          {hasTools && (
            <div className="space-y-1.5">
              {msg.toolCalls!.map((c) => (
                <ToolCallCard
                  key={c.id}
                  call={c}
                  onRun={onRunTool ? () => onRunTool(c) : undefined}
                />
              ))}
            </div>
          )}
          {msg.sources && msg.sources.length > 0 && (
            <div className="pl-1 text-[11px] text-muted-foreground">
              Источник: {msg.sources[0].name ?? "база знаний"}
              {msg.sources.length > 1 && (
                <details className="inline ml-1">
                  <summary className="cursor-pointer underline underline-offset-2">
                    +{msg.sources.length - 1}
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {msg.sources.map((s, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-muted/60 p-2 text-foreground/80 text-[12px]"
                      >
                        {s.snippet}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {msg.created_at && (
            <div className="pl-1 text-[10px] text-muted-foreground/70">
              {formatDate(msg.created_at)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // user
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[85%]">
        <div
          className="inline-block px-4 py-2.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap"
          style={{
            background: brand.accentColor,
            borderRadius: "18px 18px 4px 18px",
          }}
        >
          {msg.content}
        </div>
        {msg.created_at && (
          <div className="text-right pr-1 mt-0.5 text-[10px] text-muted-foreground/70">
            {formatDate(msg.created_at)}
          </div>
        )}
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  send_email: "Отправить email",
  send_telegram: "Написать в Telegram",
  create_meeting: "Создать встречу",
  add_to_calendar: "Добавить в календарь",
  find_client: "Найти клиента",
  generate_document: "Сгенерировать документ",
  remember_fact: "Запомнить факт",
};

function ToolCallCard({ call, onRun }: { call: ToolCall; onRun?: () => void }) {
  const label = TOOL_LABELS[call.name] ?? call.name;
  const s = call.status ?? "pending";
  const argsList = Object.entries(call.arguments).slice(0, 6);
  return (
    <div className="inline-block w-full max-w-md rounded-2xl border bg-card p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] tracking-wider uppercase text-muted-foreground">
            Действие
          </span>
          <span className="font-medium truncate">{label}</span>
        </div>
        <span
          className={cn(
            "text-[11px] rounded-full px-2 py-0.5",
            s === "done" && "bg-emerald-500/10 text-emerald-700",
            s === "error" && "bg-destructive/10 text-destructive",
            s === "running" && "bg-muted text-muted-foreground",
            s === "pending" && "bg-[#F59E0B]/10 text-[#B45309]"
          )}
        >
          {s === "pending"
            ? "ждёт подтверждения"
            : s === "running"
            ? "выполняется…"
            : s === "done"
            ? "выполнено"
            : "ошибка"}
        </span>
      </div>
      {argsList.length > 0 && (
        <dl className="mt-2 space-y-0.5 text-[12px]">
          {argsList.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-muted-foreground shrink-0 w-24 truncate">{k}</dt>
              <dd className="min-w-0 flex-1 truncate">{String(v ?? "")}</dd>
            </div>
          ))}
        </dl>
      )}
      {s === "pending" && onRun && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onRun}
            className="rounded-full bg-foreground text-background px-3 h-8 text-[12px] font-medium"
          >
            Подтвердить
          </button>
        </div>
      )}
      {s === "error" && call.result?.error && (
        <div className="mt-2 text-[12px] text-destructive">{String(call.result.error)}</div>
      )}
    </div>
  );
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  const icon =
    a.status === "uploading" ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
    ) : a.status === "error" ? (
      <AlertCircle className="w-3.5 h-3.5 text-destructive" />
    ) : (
      <Check className="w-3.5 h-3.5 text-emerald-600" />
    );
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] bg-card max-w-[260px]",
        a.status === "error" ? "border-destructive/30 text-destructive" : "border-border"
      )}
      title={a.status === "error" ? a.error : a.name}
    >
      <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[160px]">{a.name}</span>
      {icon}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
        aria-label="Убрать"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
          style={{ background: color, animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

function EmptyState({
  welcome,
  suggestions,
  onPick,
}: {
  welcome: string;
  suggestions: string[];
  onPick: (t: string) => void;
}) {
  return (
    <div className="pt-8 md:pt-16 pb-4 text-center">
      <div className="inline-flex">
        <MascotAvatar size={96} animated />
      </div>
      <h1 className="mt-5 text-[22px] md:text-2xl font-semibold tracking-tight">
        {welcome}
      </h1>

      {/* горизонтальные pills с прокруткой */}
      <div className="mt-7 -mx-3 md:mx-0 overflow-x-auto no-scrollbar">
        <div className="px-3 md:px-0 flex gap-2 md:flex-wrap md:justify-center">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="shrink-0 rounded-full border border-border bg-card px-4 h-10 text-[13px] hover:bg-muted transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
