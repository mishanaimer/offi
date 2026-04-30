"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GuestMascot, MascotLoader, useMascotEmotions } from "@/components/mascot";

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const mascot = useMascotEmotions("idle");

  // Первый контакт — маскот машет (joy).
  useEffect(() => {
    const id = window.setTimeout(() => mascot.fire("joy"), 500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Реагирует, когда пользователь дописал имя (после паузы 900мс).
  useEffect(() => {
    if (!fullName.trim()) return;
    const id = window.setTimeout(() => mascot.fire("love"), 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName]);

  useEffect(() => {
    if (err) mascot.fire("surprise");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!consent) {
      mascot.fire("surprise");
      return setErr("Чтобы создать аккаунт, нужно принять Оферту и Политику обработки персональных данных.");
    }
    mascot.setState("working");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, consent_pd_at: new Date().toISOString() } },
    });
    if (error) {
      mascot.setState("idle");
      return setErr(error.message);
    }
    mascot.fire("joy");
    startTransition(() => {
      router.push("/onboarding");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        {pending ? (
          <MascotLoader size={104} state="working" label="Создаём аккаунт…" />
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
            <h1 className="mt-4 text-xl font-bold tracking-[-0.02em]">
              {fullName.trim() ? `Привет, ${fullName.trim().split(" ")[0]}!` : "Давайте знакомиться"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Я — Оффи, ваш AI-помощник. Заведём аккаунт за минуту.
            </p>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Ваше имя</Label>
          <Input
            id="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onFocus={() => mascot.fire("pensive")}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => mascot.fire("wink")}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => mascot.fire("sleepy")}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">Минимум 6 символов</p>
        </div>
        {/* Согласие на ПДн (152-ФЗ) */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-border text-primary focus:ring-2 focus:ring-primary/30 focus:ring-offset-0"
            aria-describedby="consent-text"
          />
          <span id="consent-text" className="text-xs leading-[1.5] text-muted-foreground">
            Я принимаю{" "}
            <Link href="/legal/offer" target="_blank" className="text-primary hover:underline">
              Оферту
            </Link>
            {" и "}
            <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">
              Политику обработки персональных данных
            </Link>
            {" и даю согласие на обработку моих данных в соответствии с 152-ФЗ."}
          </span>
        </label>

        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={pending || !consent}>
          {pending ? "Создаём…" : "Создать аккаунт"}
        </Button>
      </form>
    </div>
  );
}
