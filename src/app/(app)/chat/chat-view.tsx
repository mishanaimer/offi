"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ document_id: string; snippet: string }>;
  created_at?: string;
  streaming?: boolean;
};

const SUGGESTIONS = [
  "Сделай краткое резюме моей базы знаний",
  "Напиши шаблон КП для клиента",
  "Что мы предлагаем для малого бизнеса?",
];

export function ChatView({
  channelId,
  initialMessages,
  assistantName,
  companyName,
}: {
  channelId: string | null;
  initialMessages: Array<{ id: string; user_id: string | null; content: string; is_ai: boolean; created_at: string; sources?: any }>;
  assistantName: string;
  companyName: string;
}) {
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

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, created_at: new Date().toISOString() };
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
      if (!res.ok || !res.body) throw new Error("chat failed");

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
      setMessages((m) => m.map((msg) => (msg.id === pendingAi.id ? { ...msg, streaming: false } : msg)));
    } catch (e) {
      setMessages((m) =>
        m.map((msg) => (msg.id === pendingAi.id ? { ...msg, streaming: false, content: "Не удалось получить ответ. Проверьте ROUTERAI_API_KEY." } : msg))
      );
    } finally {
      setSending(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-dvh-screen">
      {/* header */}
      <header className="h-16 shrink-0 glass border-b border-border/60 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">{assistantName}</div>
            <div className="text-xs text-muted-foreground">{companyName}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm"><Plus className="w-4 h-4" /> Новый</Button>
      </header>

      {/* messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="container-page py-6">
          {empty ? (
            <EmptyState assistantName={assistantName} onPick={(t) => send(t)} />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => <MessageBubble key={m.id} msg={m} assistantName={assistantName} />)}
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-border/60 bg-background px-3 md:px-6 py-3">
        <div className="container-page max-w-3xl">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2"
          >
            <Textarea
              placeholder={`Спросите у ${assistantName}…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              className="min-h-[48px] max-h-[180px] py-3"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || sending} aria-label="Отправить">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Offi может ошибаться. Проверяйте важные факты.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, assistantName }: { msg: Msg; assistantName: string }) {
  const isAi = msg.role === "assistant";
  return (
    <div className={cn("flex gap-3 animate-fade-in", isAi ? "" : "flex-row-reverse")}>
      <div className={cn("w-8 h-8 rounded-full grid place-items-center shrink-0", isAi ? "bg-primary/10 text-primary" : "bg-muted text-foreground")}>
        {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className={cn("max-w-[85%] space-y-1.5", isAi ? "" : "text-right")}>
        <div className={cn("text-xs text-muted-foreground", isAi ? "" : "text-right")}>
          {isAi ? assistantName : "Вы"}
          {msg.created_at && <> · {formatDate(msg.created_at)}</>}
        </div>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed inline-block text-left",
          isAi ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        )}>
          {isAi ? (
            msg.content ? (
              <div className="prose prose-sm max-w-none [&>p]:my-1 [&>ul]:my-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot [animation-delay:200ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot [animation-delay:400ms]" />
              </span>
            )
          ) : (
            msg.content
          )}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Источники ({msg.sources.length})</summary>
            <ul className="mt-2 space-y-1.5">
              {msg.sources.map((s, i) => (
                <li key={i} className="rounded-lg bg-muted/60 p-2 text-foreground/80">{s.snippet}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function EmptyState({ assistantName, onPick }: { assistantName: string; onPick: (t: string) => void }) {
  return (
    <div className="max-w-xl mx-auto pt-10 md:pt-20 text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-primary/10 text-primary items-center justify-center">
        <Sparkles className="w-5 h-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Привет! Я {assistantName}.</h1>
      <p className="mt-2 text-muted-foreground">Спросите что-нибудь о вашем бизнесе или попросите сделать действие.</p>
      <div className="mt-8 grid gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-left hover:border-primary/30 hover:bg-muted transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
