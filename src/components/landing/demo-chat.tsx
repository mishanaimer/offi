"use client";

import { useEffect, useRef, useState } from "react";
import { OffiMark } from "@/components/logo";
import { Input } from "@/components/ui/input";

type Msg = { from: "user" | "ai"; text: string };

const REPLIES: Record<string, string> = {
  default: "Готово! Подготовила результат. Хотите что-нибудь изменить?",
  договор: "Договор №48 сформирован по шаблону «Услуги ИП». Сумма: 150 000 ₽. Отправить на подпись? 📄",
  письмо: "✉️ Письмо готово:\n\n«Добрый день! Направляем вам обновлённое коммерческое предложение...»\n\nОтправить?",
  встреча: "📅 Нашла окно: завтра, 14:00–15:00. Участники: вы + Иванов И.П. Создать в Google Calendar?",
  отчёт: "📊 Вот сводка за апрель:\n• Новых клиентов: 12\n• Выручка: 1.2М ₽ (+18%)\n• Средний чек: 43 500 ₽",
  клиент: "🔍 Нашла 3 записи. Самый активный — ООО «Вектор», 8 сделок за квартал.",
};

const CHIPS = [
  { label: "📄 Подготовь договор", q: "Подготовь договор" },
  { label: "✉️ Напиши письмо", q: "Напиши письмо клиенту" },
  { label: "📅 Назначь встречу", q: "Назначь встречу" },
  { label: "📊 Покажи отчёт", q: "Покажи отчёт за апрель" },
];

export function DemoChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { from: "ai", text: "Привет! Я Offi — ваш AI-ассистент. Чем помочь сегодня?" },
  ]);
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, typing]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const key = Object.keys(REPLIES).find((k) => k !== "default" && q.toLowerCase().includes(k));
      setTyping(false);
      setMessages((m) => [...m, { from: "ai", text: REPLIES[key ?? "default"] }]);
    }, 1400);
  };

  return (
    <>
      <div
        className="rounded-[20px] border border-border bg-card overflow-hidden"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 16px 48px rgba(2,89,221,0.06)" }}
      >
        {/* header */}
        <div className="flex items-center gap-2.5 px-[18px] py-3 border-b border-[hsl(var(--border-light))]">
          <OffiMark size={34} />
          <div>
            <div className="text-sm font-semibold text-foreground">Offi</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
              <span className="text-[11px] text-[hsl(var(--text-tertiary))]">Онлайн</span>
            </div>
          </div>
        </div>
        {/* messages */}
        <div ref={scroller} className="p-[18px] min-h-[200px] max-h-[280px] overflow-y-auto">
          {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          {typing && (
            <div className="flex gap-2.5 anim-slide-right">
              <OffiMark size={30} />
              <div className="px-3.5 py-2.5 rounded-[14px] rounded-tl-[4px] bg-[hsl(var(--accent-brand-light))]">
                <TypingDots />
              </div>
            </div>
          )}
        </div>
        {/* composer */}
        <div className="px-[18px] py-3 border-t border-[hsl(var(--border-light))] flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Напишите задачу..."
            className="flex-1 h-10 text-[13px]"
          />
          <button
            onClick={() => send()}
            className="w-10 h-10 rounded-[10px] grid place-items-center text-lg transition-all"
            style={{
              background: input.trim() ? "hsl(var(--accent-brand))" : "hsl(var(--surface-alt))",
              color: input.trim() ? "#fff" : "hsl(var(--text-tertiary))",
            }}
          >↑</button>
        </div>
      </div>

      {/* chips */}
      <div className="flex gap-2 mt-3.5 flex-wrap justify-center">
        {CHIPS.map((c) => (
          <button
            key={c.q}
            onClick={() => send(c.q)}
            className="btn-bounce px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-[hsl(var(--accent-brand-light))]"
          >
            {c.label}
          </button>
        ))}
      </div>
    </>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.from === "user";
  return (
    <div className={`flex gap-2.5 mb-3.5 ${isUser ? "flex-row-reverse" : ""} ${isUser ? "anim-slide-left" : "anim-slide-right"}`}>
      <div
        className="w-[30px] h-[30px] rounded-full grid place-items-center text-[12px] font-bold shrink-0 transition-transform duration-300 hover:scale-105"
        style={{
          background: isUser ? "hsl(var(--surface-alt))" : "hsl(var(--accent-brand))",
          color: isUser ? "hsl(var(--foreground))" : "#fff",
        }}
      >
        {isUser ? "Вы" : "O"}
      </div>
      <div
        className="px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground max-w-[360px] whitespace-pre-line"
        style={{
          borderRadius: 14,
          borderTopLeftRadius: isUser ? 14 : 4,
          borderTopRightRadius: isUser ? 4 : 14,
          background: isUser ? "hsl(var(--card))" : "hsl(var(--accent-brand-light))",
          border: isUser ? "1px solid hsl(var(--border))" : "none",
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={{ animation: `dot-bounce 1.2s ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}
