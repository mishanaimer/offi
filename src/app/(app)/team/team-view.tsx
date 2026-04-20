"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Hash, Plus, Send, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatDate, cn } from "@/lib/utils";

type Channel = { id: string; name: string; type: string; created_at: string };
type Msg = { id: string; user_id: string | null; content: string; is_ai: boolean; pinned: boolean; created_at: string };

export function TeamView({ initialChannels }: { initialChannels: Channel[] }) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [current, setCurrent] = useState<Channel | null>(initialChannels[0] ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // load messages + Realtime
  useEffect(() => {
    if (!current) return;
    const supabase = createClient();
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", current.id)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data ?? []) as Msg[]);

      channelSub = supabase
        .channel(`messages:${current.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${current.id}` },
          (payload) => setMessages((m) => [...m, payload.new as Msg])
        )
        .subscribe();
    })();

    return () => {
      if (channelSub) channelSub.unsubscribe();
    };
  }, [current]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!current || !input.trim()) return;
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("messages").insert({
      channel_id: current.id,
      user_id: user.user?.id,
      content: input.trim(),
    });
    setInput("");
  }

  async function createChannel(fd: FormData) {
    const supabase = createClient();
    const { data } = await supabase
      .from("channels")
      .insert({ name: String(fd.get("name") ?? ""), type: "group" })
      .select()
      .single();
    if (data) {
      setChannels((c) => [...c, data as Channel]);
      setCurrent(data as Channel);
    }
    setCreating(false);
  }

  async function togglePin(id: string, current: boolean) {
    const supabase = createClient();
    await supabase.from("messages").update({ pinned: !current }).eq("id", id);
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, pinned: !current } : x)));
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-[260px_1fr]">
      {/* sidebar */}
      <aside className="border-r border-border/60 flex flex-col overflow-hidden max-h-dvh md:max-h-none">
        <div className="h-16 px-4 flex items-center justify-between border-b border-border/60">
          <div className="font-semibold">Команда</div>
          <Button size="icon" variant="ghost" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setCurrent(c)}
              className={cn("w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition", current?.id === c.id ? "bg-muted" : "hover:bg-muted/60")}
            >
              <Hash className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{c.name}</span>
              {c.type === "ai" && <span className="ml-auto text-[10px] uppercase text-primary">AI</span>}
            </button>
          ))}
          {creating && (
            <form action={createChannel} className="mt-2 px-1 space-y-2">
              <Input name="name" placeholder="Название канала" autoFocus required />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Отмена</Button>
                <Button type="submit" size="sm">Создать</Button>
              </div>
            </form>
          )}
        </div>
      </aside>

      {/* content */}
      <div className="flex flex-col overflow-hidden">
        <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center gap-3">
          <Hash className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">{current?.name ?? "—"}</h2>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="container-page max-w-3xl py-6 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="group flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted grid place-items-center shrink-0 text-xs font-medium">
                  {m.is_ai ? "AI" : "?"}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{formatDate(m.created_at)}</div>
                  <div className="mt-0.5 text-sm leading-relaxed">{m.content}</div>
                </div>
                <button onClick={() => togglePin(m.id, m.pinned)} className={cn("opacity-0 group-hover:opacity-100 transition", m.pinned && "opacity-100 text-primary")} aria-label="Закрепить">
                  <Pin className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="border-t border-border/60 px-3 md:px-6 py-3">
          <form
            className="container-page max-w-3xl flex items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <Textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Сообщение команде"
              className="min-h-[44px]"
            />
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Отправить">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
