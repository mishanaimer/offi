"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GuestMascot, MascotLoader, useMascotEmotions } from "@/components/mascot";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const mascot = useMascotEmotions("idle");

  // Приветствие при первом показе формы — маскот подмигивает.
  useEffect(() => {
    const id = window.setTimeout(() => mascot.fire("wink"), 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ошибка → удивлённый маскот.
  useEffect(() => {
    if (err) mascot.fire("surprise");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    mascot.setState("working");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      mascot.setState("idle");
      return setErr(error.message);
    }
    mascot.fire("joy");
    startTransition(() => {
      router.push(next ?? "/chat");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        {pending ? (
          <MascotLoader size={104} state="working" label="Входим в систему…" />
        ) : (
          <>
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full anim-halo pointer-events-none"
                style={{
                  background: "radial-gradient(closest-side, hsl(var(--accent-brand-light)), transparent 70%)",
                }}
                aria-hidden
              />
              <GuestMascot
                size={96}
                state={mascot.props.state}
                oneshotId={mascot.props.oneshotId}
                oneshotKey={mascot.props.oneshotKey}
                animated
                trackCursor
              />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-[-0.02em]">С возвращением!</h1>
            <p className="mt-1 text-sm text-muted-foreground">Оффи уже заварил чай ☕</p>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => mascot.fire("pensive")}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => mascot.fire("sleepy")}
            disabled={pending}
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Входим…" : "Войти"}
        </Button>
      </form>
    </div>
  );
}
