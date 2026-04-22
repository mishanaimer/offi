"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Hash,
  Plus,
  Send,
  Pin,
  ArrowLeft,
  MessageSquare,
  Users,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useBranding } from "@/components/branding-provider";
import { AssistantAvatar } from "@/components/assistant-avatar";
import { useApiHealth } from "@/components/api-health";

type Channel = { id: string; name: string; type: string; created_at: string };
type Msg = {
  id: string;
  user_id: string | null;
  content: string;
  is_ai: boolean;
  pinned: boolean;
  created_at: string;
};
type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  position: string | null;
};

export function TeamView({
  currentUser,
  initialChannels,
  companyMembers,
}: {
  currentUser: { id: string };
  initialChannels: Channel[];
  companyMembers: Member[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const brand = useBranding();
  const { recordSuccess, recordFailure } = useApiHealth();

  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const selectedId = params.get("c");
  const current = useMemo(
    () => channels.find((c) => c.id === selectedId) ?? null,
    [channels, selectedId]
  );

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [invokingAi, setInvokingAi] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- @-упоминания ---
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = нет активного меншна
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return companyMembers
      .filter((m) => m.id !== currentUser.id)
      .filter((m) => {
        const s = `${m.full_name ?? ""} ${m.email}`.toLowerCase();
        return q === "" || s.includes(q);
      })
      .slice(0, 6);
  }, [companyMembers, currentUser.id, mentionQuery]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const d = el.scrollHeight - el.clientHeight - el.scrollTop;
      stuck.current = d < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [current?.id]);

  useLayoutEffect(() => {
    if (!stuck.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  // load + subscribe
  useEffect(() => {
    if (!current) {
      setMessages([]);
      return;
    }
    setMessages([]);
    const supabase = createClient();
    let sub: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", current.id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data ?? []) as Msg[]);
      stuck.current = true;

      sub = supabase
        .channel(`messages:${current.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${current.id}`,
          },
          (payload) => setMessages((m) => [...m, payload.new as Msg])
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${current.id}`,
          },
          (payload) =>
            setMessages((m) =>
              m.map((x) => (x.id === (payload.new as Msg).id ? (payload.new as Msg) : x))
            )
        )
        .subscribe();
    })();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [current?.id]);

  const membersById = useMemo(
    () => new Map(companyMembers.map((m) => [m.id, m])),
    [companyMembers]
  );

  // Отслеживает незаконченное «@query» непосредственно перед курсором.
  function recomputeMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) {
      setMentionQuery(null);
      return;
    }
    const prev = at === 0 ? " " : before[at - 1];
    const sep = /[\s\n]/.test(prev) || at === 0;
    const query = before.slice(at + 1);
    if (sep && !/\s/.test(query)) {
      setMentionQuery(query);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: Member) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? input.length;
    const before = input.slice(0, caret);
    const after = input.slice(caret);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const handle = (member.full_name || member.email.split("@")[0] || "user").replace(/\s+/g, "_");
    const token = `@${handle} `;
    const next = before.slice(0, at) + token + after;
    setInput(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = at + token.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  async function sendMessage() {
    if (!current || !input.trim() || sending) return;
    setSending(true);
    setErr(null);
    const text = input.trim();
    setInput("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("messages").insert({
        channel_id: current.id,
        user_id: currentUser.id,
        content: text,
      });
      if (error) throw error;

      // если это канал с AI — триггерим ответ
      if (current.type === "ai") {
        await invokeAi(current.id, false);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function invokeAi(channelId: string, showIndicator = true) {
    if (showIndicator) setInvokingAi(true);
    try {
      const res = await fetch("/api/team/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: channelId }),
      });
      if (!res.ok) {
        if (res.status >= 500) recordFailure();
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "AI failed");
      }
      recordSuccess();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      if (showIndicator) setInvokingAi(false);
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    const supabase = createClient();
    await supabase.from("messages").update({ pinned: !pinned }).eq("id", id);
  }

  async function handleCreate(payload: {
    type: "dm" | "group" | "shared_ai";
    name: string;
    memberIds: string[];
  }) {
    const res = await fetch("/api/team/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: payload.type,
        name: payload.name,
        member_ids: payload.memberIds,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "create failed");
      return;
    }
    const { channel } = await res.json();
    setChannels((c) => [...c, channel]);
    setShowCreate(false);
    router.push(`/team?c=${channel.id}`);
  }

  function openChannel(id: string) {
    router.push(`/team?c=${id}`);
  }
  function back() {
    router.push("/team");
  }

  const mobileShowChat = !!current;

  return (
    <div className="flex-1 flex min-h-0 h-full">
      {/* sidebar */}
      <aside
        className={cn(
          "w-full md:w-[280px] md:shrink-0 border-r border-border/60 flex-col min-h-0",
          mobileShowChat ? "hidden md:flex" : "flex"
        )}
      >
        <div className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-border/60">
          <div className="font-semibold">Команда</div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowCreate(true)}
            aria-label="Новый канал"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {channels.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Нет каналов. Создайте первый.
            </div>
          ) : (
            channels.map((c) => {
              const title = displayName(c, companyMembers, currentUser.id);
              const active = current?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => openChannel(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    active ? "" : "hover:bg-muted/60"
                  )}
                  style={
                    active
                      ? {
                          background: `color-mix(in srgb, ${brand.accentColor} 12%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <ChannelIcon type={c.type} accent={brand.accentColor} />
                  <span className="truncate flex-1 text-left">{title}</span>
                  <TypeBadge type={c.type} accent={brand.accentColor} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-0",
          mobileShowChat ? "flex" : "hidden md:flex"
        )}
      >
        {current ? (
          <>
            <header className="h-14 shrink-0 glass border-b border-border/60 px-2 md:px-6 flex items-center gap-2">
              <button
                className="md:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-muted"
                onClick={back}
                aria-label="Назад"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <ChannelIcon type={current.type} accent={brand.accentColor} />
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">
                  {displayName(current, companyMembers, currentUser.id)}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  {typeLabel(current.type, brand.assistantName)}
                </div>
              </div>
            </header>

            <div
              ref={scrollerRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            >
              <div className="mx-auto w-full max-w-3xl px-3 md:px-6 py-5 space-y-3">
                {messages.map((m) => (
                  <MsgRow
                    key={m.id}
                    msg={m}
                    author={m.user_id ? membersById.get(m.user_id) : null}
                    onTogglePin={() => togglePin(m.id, m.pinned)}
                  />
                ))}
                {invokingAi && (
                  <div className="flex gap-2.5 items-start">
                    <AssistantAvatar
                      icon={brand.assistantIcon}
                      color={brand.assistantColor}
                      size={28}
                    />
                    <div
                      className="px-4 py-2.5 bg-[#f5f5f5]"
                      style={{ borderRadius: "18px 18px 18px 4px" }}
                    >
                      <span className="inline-flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                            style={{
                              background: brand.assistantColor,
                              animationDelay: `${i * 180}ms`,
                            }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="shrink-0 bg-background/95 backdrop-blur border-t border-border/60 px-3 md:px-6 pt-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
            >
              <div className="mx-auto w-full max-w-3xl">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="relative flex items-end gap-2 rounded-2xl bg-white border p-2.5"
                  style={{
                    borderColor: `color-mix(in srgb, ${brand.accentColor} 15%, transparent)`,
                  }}
                >
                  {mentionQuery !== null && mentionMatches.length > 0 && (
                    <div className="absolute left-2 right-2 bottom-full mb-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden z-10">
                      {mentionMatches.map((m, i) => (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertMention(m);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 flex items-center gap-2 text-[13px]",
                            i === mentionIndex ? "bg-muted" : "hover:bg-muted/60"
                          )}
                        >
                          <span
                            className="w-6 h-6 rounded-full grid place-items-center text-white text-[10px] font-medium shrink-0"
                            style={{
                              background: `color-mix(in srgb, ${brand.accentColor} 80%, #000 0%)`,
                            }}
                          >
                            {((m.full_name ?? m.email)[0] ?? "?").toUpperCase()}
                          </span>
                          <span className="truncate">
                            {m.full_name || m.email.split("@")[0]}
                          </span>
                          <span className="ml-auto text-[11px] text-muted-foreground truncate">
                            {m.position ?? m.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      recomputeMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                    }}
                    onKeyUp={(e) => {
                      const el = e.currentTarget;
                      recomputeMention(el.value, el.selectionStart ?? el.value.length);
                    }}
                    onKeyDown={(e) => {
                      if (mentionQuery !== null && mentionMatches.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setMentionIndex((i) => (i + 1) % mentionMatches.length);
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          insertMention(mentionMatches[mentionIndex]);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setMentionQuery(null);
                          return;
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      current.type === "ai"
                        ? `Спросите ${brand.assistantName}…`
                        : "Сообщение команде (введите @ чтобы упомянуть)"
                    }
                    className="flex-1 resize-none bg-transparent outline-none px-1.5 py-1.5 text-[16px] md:text-[15px] leading-[1.5] max-h-[140px]"
                    style={{ minHeight: 34 }}
                  />
                  {current.type === "shared_ai" && (
                    <button
                      type="button"
                      onClick={() => invokeAi(current.id)}
                      disabled={invokingAi}
                      className="h-[34px] px-3 rounded-full text-[13px] text-white inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                      style={{ background: brand.assistantColor }}
                      aria-label="Спросить ассистента"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {brand.assistantName}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="w-[34px] h-[34px] rounded-full grid place-items-center text-white transition shrink-0 disabled:opacity-40"
                    style={{ background: brand.accentColor }}
                    aria-label="Отправить"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                {err && <p className="mt-1.5 text-xs text-destructive">{err}</p>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-center p-8">
            <div>
              <div className="inline-flex w-12 h-12 rounded-full bg-muted items-center justify-center">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Выберите канал слева или создайте новый.
              </p>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateChannel
          currentUserId={currentUser.id}
          members={companyMembers}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          accent={brand.accentColor}
          assistantName={brand.assistantName}
        />
      )}
    </div>
  );
}

function MsgRow({
  msg,
  author,
  onTogglePin,
}: {
  msg: Msg;
  author: Member | null | undefined;
  onTogglePin: () => void;
}) {
  const brand = useBranding();

  if (msg.is_ai) {
    return (
      <div className="flex gap-2.5 items-start">
        <AssistantAvatar icon={brand.assistantIcon} color={brand.assistantColor} size={28} />
        <div className="max-w-[85%]">
          <div
            className="inline-block px-4 py-2.5 text-[15px] leading-relaxed bg-[#f5f5f5] text-[#0a0a0a] whitespace-pre-wrap"
            style={{ borderRadius: "18px 18px 18px 4px" }}
          >
            {msg.content}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/70 pl-1">
            {brand.assistantName} · {formatDate(msg.created_at)}
          </div>
        </div>
      </div>
    );
  }

  const label = author?.full_name ?? author?.email ?? "—";
  const initial = (author?.full_name ?? author?.email ?? "?")[0]?.toUpperCase();

  return (
    <div className="flex gap-2.5 items-start group">
      <div
        className="w-7 h-7 rounded-full grid place-items-center text-white text-[11px] font-medium shrink-0"
        style={{ background: `color-mix(in srgb, ${brand.accentColor} 80%, #000 0%)` }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">
          {label} · {formatDate(msg.created_at)}
        </div>
        <div className="mt-0.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          <MentionedText text={msg.content} accent={brand.accentColor} />
        </div>
      </div>
      <button
        onClick={onTogglePin}
        className={cn(
          "opacity-0 group-hover:opacity-100 transition p-1 shrink-0",
          msg.pinned && "opacity-100"
        )}
        style={msg.pinned ? { color: brand.accentColor } : undefined}
        aria-label="Закрепить"
      >
        <Pin className="w-4 h-4" />
      </button>
    </div>
  );
}

function MentionedText({ text, accent }: { text: string; accent: string }) {
  // Разбиваем по токенам @word_or_dotted, остальное рендерим как есть.
  const parts = text.split(/(@[\p{L}\p{N}_.-]+)/u);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && p.length > 1 ? (
          <span
            key={i}
            className="rounded px-1 font-medium"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              color: accent,
            }}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function ChannelIcon({ type, accent }: { type: string; accent: string }) {
  if (type === "ai" || type === "shared_ai")
    return <Sparkles className="w-4 h-4 shrink-0" style={{ color: accent }} />;
  if (type === "dm") return <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />;
  return <Hash className="w-4 h-4 text-muted-foreground shrink-0" />;
}

function TypeBadge({ type, accent }: { type: string; accent: string }) {
  if (type === "shared_ai")
    return (
      <span
        className="text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
        }}
      >
        +AI
      </span>
    );
  if (type === "ai")
    return (
      <span
        className="text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0"
        style={{ background: accent, color: "#fff" }}
      >
        AI
      </span>
    );
  return null;
}

function typeLabel(type: string, assistantName: string) {
  if (type === "ai") return `Личный чат с ${assistantName}`;
  if (type === "shared_ai") return `Команда + ${assistantName}`;
  if (type === "dm") return "Личные сообщения";
  return "Групповой канал";
}

function displayName(channel: Channel, members: Member[], selfId: string) {
  if (channel.type === "dm") {
    // имя — того участника, кто не я. Но у нас сейчас нет списка участников на клиенте.
    // Fallback: используем channel.name; если пусто, "ЛС".
    return channel.name || "Личные сообщения";
  }
  return channel.name || "Без названия";
}

function CreateChannel({
  currentUserId,
  members,
  onClose,
  onCreate,
  accent,
  assistantName,
}: {
  currentUserId: string;
  members: Member[];
  onClose: () => void;
  onCreate: (p: { type: "dm" | "group" | "shared_ai"; name: string; memberIds: string[] }) => void;
  accent: string;
  assistantName: string;
}) {
  const others = members.filter((m) => m.id !== currentUserId);
  const [type, setType] = useState<"dm" | "group" | "shared_ai">("group");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return others;
    return others.filter((m) =>
      [m.full_name, m.email, m.position].some((v) => v && v.toLowerCase().includes(s))
    );
  }, [search, others]);

  function toggle(id: string) {
    setSelected((s) =>
      type === "dm" ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  }

  async function submit() {
    if (type === "dm" && selected.length !== 1) return;
    if (type !== "dm" && selected.length === 0) return;
    setBusy(true);
    let effectiveName = name.trim();
    if (type === "dm" && !effectiveName) {
      const other = others.find((m) => m.id === selected[0]);
      effectiveName = other?.full_name ?? other?.email ?? "Личные сообщения";
    }
    await onCreate({ type, name: effectiveName, memberIds: selected });
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md bg-background rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Новый канал</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <TypeCard
            active={type === "dm"}
            icon={<MessageSquare className="w-5 h-5" />}
            title="ЛС"
            desc="1-на-1"
            onClick={() => {
              setType("dm");
              setSelected([]);
            }}
            accent={accent}
          />
          <TypeCard
            active={type === "group"}
            icon={<Users className="w-5 h-5" />}
            title="Группа"
            desc="участники"
            onClick={() => {
              setType("group");
              setSelected([]);
            }}
            accent={accent}
          />
          <TypeCard
            active={type === "shared_ai"}
            icon={<Sparkles className="w-5 h-5" />}
            title="+AI"
            desc={assistantName}
            onClick={() => {
              setType("shared_ai");
              setSelected([]);
            }}
            accent={accent}
          />
        </div>

        {type !== "dm" && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Название</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "shared_ai" ? "Проект X + ассистент" : "Команда"}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            {type === "dm" ? "Выберите собеседника" : "Участники"}
          </label>
          <Input
            placeholder="Поиск по имени или email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Никого не найдено.
              </div>
            )}
            {filtered.map((m) => {
              const checked = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40"
                >
                  <div
                    className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-medium shrink-0"
                    style={{ background: `color-mix(in srgb, ${accent} 80%, #000 0%)` }}
                  >
                    {(m.full_name ?? m.email)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.full_name ?? m.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  {checked && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: accent }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={
              busy ||
              (type === "dm" ? selected.length !== 1 : selected.length === 0)
            }
            onClick={submit}
            style={{ background: accent }}
          >
            {busy ? "Создаём…" : "Создать"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TypeCard({
  active,
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition",
        active ? "border-transparent" : "border-border hover:bg-muted/40"
      )}
      style={
        active
          ? {
              background: `color-mix(in srgb, ${accent} 10%, transparent)`,
              borderColor: accent,
            }
          : undefined
      }
    >
      <div style={active ? { color: accent } : { color: "var(--muted-foreground)" }}>{icon}</div>
      <div className="mt-2 text-sm font-medium">{title}</div>
      <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
    </button>
  );
}
