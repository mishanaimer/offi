"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Paperclip, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn, formatDate } from "@/lib/utils";
import { useBranding } from "@/components/branding-provider";
import { AssistantAvatar } from "@/components/assistant-avatar";
import { bucket } from "@/lib/plans";
import Link from "next/link";
import { useApiHealth } from "@/components/api-health";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ document_id: string; snippet: string; name?: string }>;
  created_at?: string;
  streaming?: boolean;
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
  const { recordSuccess, recordFailure } = useApiHealth();

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

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");
    stuckToBottomRef.current = true;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const pendingAi: Msg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((m) => [...m, userMsg, pendingAi]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          message: text,
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
  const canSend = input.trim().length > 0 && !sending && !quotaBlocked;

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
          <AssistantAvatar icon={brand.assistantIcon} color={brand.assistantColor} size={28} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight truncate">{brand.assistantName}</div>
            <div className="text-[11px] text-muted-foreground leading-tight truncate">{brand.companyName}</div>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 h-9 text-[13px] hover:bg-muted transition"
          aria-label="Новый чат"
        >
          <Plus className="w-4 h-4" /> Новый
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
              assistantIcon={brand.assistantIcon}
              assistantColor={brand.assistantColor}
              suggestions={suggestions}
              onPick={(t) => send(t)}
            />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl bg-white border p-2.5 shadow-sm"
            style={promptBorder}
          >
            <button
              type="button"
              className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:bg-muted transition shrink-0"
              aria-label="Прикрепить файл"
              title="Прикрепить файл (скоро)"
              disabled
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

function MessageBubble({ msg }: { msg: Msg }) {
  const brand = useBranding();
  const isAi = msg.role === "assistant";

  if (isAi) {
    return (
      <div className="flex gap-2.5 animate-fade-in">
        <AssistantAvatar icon={brand.assistantIcon} color={brand.assistantColor} size={28} />
        <div className="max-w-[85%] space-y-1">
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
  assistantIcon,
  assistantColor,
  suggestions,
  onPick,
}: {
  welcome: string;
  assistantIcon: string;
  assistantColor: string;
  suggestions: string[];
  onPick: (t: string) => void;
}) {
  return (
    <div className="pt-8 md:pt-16 pb-4 text-center">
      <div className="inline-flex">
        <AssistantAvatar icon={assistantIcon} color={assistantColor} size={56} />
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
