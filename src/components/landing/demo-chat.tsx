"use client";

import { useEffect, useState } from "react";
import { Bot, User, Send } from "lucide-react";

type Msg = { from: "user" | "ai"; text: string };

const SCRIPT: Msg[] = [
  { from: "user", text: "Сколько стоит внедрение за месяц?" },
  { from: "ai", text: "По документу «Прайс 2026» — от 180 000 ₽ за месяц при пакете «Бизнес». Для 3+ сотрудников скидка 15%. Источник: pricing.pdf, стр. 2." },
  { from: "user", text: "Отправь Иванову КП и назначь звонок на четверг 14:00" },
  { from: "ai", text: "Нашёл Иванова Петра (ООО Аспект). Сформировал КП из шаблона «Стандарт». Готов отправить письмо и создать встречу в Телемосте. Подтвердите действие?" },
];

export function DemoChat() {
  const [visible, setVisible] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      for (let i = 0; i < SCRIPT.length; i++) {
        if (cancelled) return;
        if (SCRIPT[i].from === "ai") {
          setTyping(true);
          await sleep(900);
          setTyping(false);
        } else {
          await sleep(600);
        }
        setVisible((v) => [...v, SCRIPT[i]]);
        await sleep(1200);
      }
      await sleep(2200);
      if (!cancelled) {
        setVisible([]);
        run();
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card-surface overflow-hidden shadow-[var(--shadow-lg)] tg-rounded">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-3 text-xs text-muted-foreground">offi.ai · Оффи</div>
      </div>
      <div className="p-4 h-[380px] overflow-hidden flex flex-col gap-3">
        {visible.map((m, i) => (
          <MessageBubble key={i} {...m} />
        ))}
        {typing && <TypingDots />}
      </div>
      <div className="border-t border-border px-3 py-3 flex items-center gap-2">
        <div className="flex-1 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">Спросите что-нибудь…</div>
        <button className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ from, text }: Msg) {
  const isAi = from === "ai";
  return (
    <div className={`flex gap-2 animate-fade-in ${isAi ? "" : "flex-row-reverse"}`}>
      <div className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${isAi ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
        {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${isAi ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
        {text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-2 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot [animation-delay:200ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot [animation-delay:400ms]" />
      </div>
    </div>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
