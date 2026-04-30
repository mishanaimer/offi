"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Reaction = "thumbs_up" | "thumbs_down" | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function MessageReactions({
  messageId,
  initial = null,
  disabled,
}: {
  messageId: string;
  initial?: Reaction;
  disabled?: boolean;
}) {
  const [reaction, setReaction] = useState<Reaction>(initial);
  const [pending, setPending] = useState(false);
  const isPersisted = UUID_RE.test(messageId);
  const inert = disabled || !isPersisted;

  async function send(next: Reaction) {
    if (inert || pending) return;
    const prev = reaction;
    setReaction(next);
    setPending(true);
    try {
      const res = await fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reaction: next }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setReaction(prev);
    } finally {
      setPending(false);
    }
  }

  function toggle(target: Exclude<Reaction, null>) {
    send(reaction === target ? null : target);
  }

  if (inert) return null;

  return (
    <div className="inline-flex items-center gap-1 pl-1 pt-0.5" aria-label="Оценка ответа">
      <button
        type="button"
        onClick={() => toggle("thumbs_up")}
        aria-pressed={reaction === "thumbs_up"}
        aria-label="Полезный ответ"
        className={cn(
          "h-6 w-6 grid place-items-center rounded-md text-muted-foreground transition-colors",
          reaction === "thumbs_up"
            ? "bg-[hsl(var(--accent-brand-light))] text-primary"
            : "hover:bg-[hsl(var(--surface-alt))] hover:text-foreground"
        )}
      >
        <ThumbsUp size={13} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => toggle("thumbs_down")}
        aria-pressed={reaction === "thumbs_down"}
        aria-label="Не помог"
        className={cn(
          "h-6 w-6 grid place-items-center rounded-md text-muted-foreground transition-colors",
          reaction === "thumbs_down"
            ? "bg-destructive/10 text-destructive"
            : "hover:bg-[hsl(var(--surface-alt))] hover:text-foreground"
        )}
      >
        <ThumbsDown size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
