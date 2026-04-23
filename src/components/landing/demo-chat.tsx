"use client";

// DemoChat — интерактивный демо-чат Offi на лендинге. БЕЗ автоплея:
// пользователь сам выбирает сценарий чипсом → AI стримит ответ с шагами,
// карточкой результата и подтверждением. В хедере чата — живой Оффи,
// который реагирует на состояние (idle → surprise при нажатии →
// working во время стрима → joy после результата).

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { GuestMascot, useMascotEmotions } from "@/components/mascot";
import {
  Check,
  FileText,
  Mail,
  CalendarDays,
  BarChart3,
  Search,
  Sparkles,
  Paperclip,
} from "lucide-react";

type ActionStep = {
  icon: "search" | "doc" | "mail" | "cal" | "chart" | "spark";
  text: string;
  doneText?: string;
  durMs: number;
};

type ResultCard =
  | { kind: "doc"; name: string; size: string; hint: string }
  | { kind: "mail"; to: string; subject: string; preview: string }
  | { kind: "meeting"; title: string; when: string; people: string[] }
  | { kind: "stats"; items: { label: string; value: string; delta?: string }[] };

type Scenario = {
  chip: string;
  query: string;
  reply: string;
  sources?: string[];
  steps: ActionStep[];
  result?: ResultCard;
  confirm?: { primary: string; secondary: string; hint: string };
};

const SCENARIOS: Scenario[] = [
  {
    chip: "📄 Подготовь договор",
    query: "Подготовь договор для ООО «Вектор»",
    reply: "Готовлю договор по шаблону «Услуги». Реквизиты беру из базы клиентов.",
    sources: ["база-клиентов.xlsx", "шаблон-договора-услуги.docx"],
    steps: [
      { icon: "search", text: "Ищу клиента «ООО Вектор»…", doneText: "Нашла: ООО «Вектор», ИНН 7701234567", durMs: 900 },
      { icon: "doc", text: "Генерирую договор №48…", doneText: "Договор №48 готов", durMs: 1100 },
    ],
    result: { kind: "doc", name: "Договор №48.docx", size: "28 КБ", hint: "Сумма: 150 000 ₽ · Срок: 30 дней" },
    confirm: { primary: "Отправить на подпись", secondary: "Открыть", hint: "через СБИС" },
  },
  {
    chip: "✉️ Напиши письмо",
    query: "Напиши письмо Иванову — перенести встречу на завтра",
    reply: "Черновик готов. Тон — деловой, но тёплый.",
    steps: [{ icon: "mail", text: "Готовлю черновик…", doneText: "Письмо собрано", durMs: 1000 }],
    result: {
      kind: "mail",
      to: "Иванов И.П. <ivanov@vector.ru>",
      subject: "Перенос встречи",
      preview:
        "Добрый день, Иван Петрович! Предлагаю перенести нашу встречу на завтра, 11:00. Если удобно — подтвердите.",
    },
    confirm: { primary: "Отправить", secondary: "Изменить", hint: "через ваш ящик" },
  },
  {
    chip: "📅 Назначь встречу",
    query: "Назначь встречу с Петровой на этой неделе",
    reply: "Нашла свободный слот у вас обоих — пятница, 14:00. Длительность — 30 минут.",
    steps: [{ icon: "cal", text: "Синхронизирую календари…", doneText: "Окно найдено", durMs: 950 }],
    result: {
      kind: "meeting",
      title: "Встреча с Петровой",
      when: "Пт, 14:00 — 14:30",
      people: ["Вы", "Петрова М.С."],
    },
    confirm: { primary: "Создать встречу", secondary: "Другое время", hint: "Google Calendar + Telemost" },
  },
  {
    chip: "📊 Покажи отчёт",
    query: "Покажи отчёт по продажам за апрель",
    reply: "Собрала данные из CRM. Апрель — рекордный месяц по выручке.",
    sources: ["amoCRM.сделки-апрель", "аналитика-2026.pdf"],
    steps: [{ icon: "chart", text: "Строю отчёт…", doneText: "Отчёт собран", durMs: 900 }],
    result: {
      kind: "stats",
      items: [
        { label: "Выручка", value: "1,24 млн ₽", delta: "+18%" },
        { label: "Новых клиентов", value: "12", delta: "+3" },
        { label: "Средний чек", value: "43 500 ₽" },
      ],
    },
  },
];

type Msg =
  | { kind: "ai-greeting"; text: string }
  | { kind: "user"; text: string }
  | {
      kind: "ai";
      text: string;
      revealed: number;
      sources?: string[];
      steps: { step: ActionStep; status: "run" | "done" }[];
      result?: ResultCard;
      confirm?: Scenario["confirm"];
      confirmChosen?: "primary";
    };

const STREAM_SPEED = 18;

export function DemoChat() {
  const [messages, setMessages] = useState<Msg[]>([
    { kind: "ai-greeting", text: "Привет! Я — Оффи. Нажмите кнопку снизу, чтобы увидеть, что я умею 👇" },
  ]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const mascot = useMascotEmotions("idle");

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Стартовое подмигивание (один раз после монтирования).
  useEffect(() => {
    const id = window.setTimeout(() => mascot.fire("wink"), 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLastAi = useCallback((patch: Partial<Extract<Msg, { kind: "ai" }>>) => {
    setMessages((m) => {
      const next = [...m];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].kind === "ai") {
          next[i] = { ...(next[i] as Extract<Msg, { kind: "ai" }>), ...patch };
          return next;
        }
      }
      return m;
    });
  }, []);

  const runScenario = useCallback(
    (s: Scenario) => {
      if (busy) return;
      clearTimers();
      setBusy(true);
      mascot.fire("surprise");
      mascot.setState("idle");

      // 1. user msg
      setMessages((m) => [...m, { kind: "user", text: s.query }]);

      // 2. AI плейсхолдер с typing dots
      schedule(() => {
        mascot.setState("working");
        setMessages((m) => [
          ...m,
          {
            kind: "ai",
            text: s.reply,
            revealed: 0,
            steps: [],
          },
        ]);
      }, 450);

      // 3. Стрим текста
      const streamStart = 1100;
      const replyChars = s.reply.length;
      for (let i = 1; i <= replyChars; i++) {
        schedule(() => updateLastAi({ revealed: i }), streamStart + i * STREAM_SPEED);
      }

      // 4. Шаги
      let cursor = streamStart + replyChars * STREAM_SPEED + 200;
      s.steps.forEach((step, i) => {
        schedule(() => {
          setMessages((m) => {
            const next = [...m];
            for (let j = next.length - 1; j >= 0; j--) {
              if (next[j].kind === "ai") {
                const ai = next[j] as Extract<Msg, { kind: "ai" }>;
                next[j] = { ...ai, steps: [...ai.steps, { step, status: "run" }] };
                return next;
              }
            }
            return m;
          });
        }, cursor);
        cursor += step.durMs;
        schedule(() => {
          setMessages((m) => {
            const next = [...m];
            for (let j = next.length - 1; j >= 0; j--) {
              if (next[j].kind === "ai") {
                const ai = next[j] as Extract<Msg, { kind: "ai" }>;
                const steps = ai.steps.map((st, k) => (k === i ? { ...st, status: "done" as const } : st));
                next[j] = { ...ai, steps };
                return next;
              }
            }
            return m;
          });
        }, cursor);
        cursor += 200;
      });

      // 5. Результат
      if (s.result) {
        schedule(() => {
          updateLastAi({ result: s.result });
          mascot.fire("joy");
        }, cursor);
        cursor += 400;
      }

      // 6. Источники
      if (s.sources) {
        schedule(() => updateLastAi({ sources: s.sources }), cursor);
        cursor += 250;
      }

      // 7. Confirm
      if (s.confirm) {
        schedule(() => updateLastAi({ confirm: s.confirm }), cursor);
        cursor += 300;
      }

      // 8. Освобождаем UI — можно нажимать следующие чипсы
      schedule(() => {
        mascot.setState("idle");
        setBusy(false);
      }, cursor + 400);
    },
    [busy, clearTimers, schedule, updateLastAi, mascot]
  );

  const onConfirm = (idx: number) => {
    setMessages((m) => {
      const next = [...m];
      const msg = next[idx];
      if (msg.kind !== "ai") return m;
      if (msg.confirmChosen) return m;
      next[idx] = { ...msg, confirmChosen: "primary" };
      return next;
    });
    mascot.fire("love");
  };

  const onSend = () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput("");
    // Ищем совпадение по ключевым словам, иначе берём первый сценарий.
    const key = q.toLowerCase();
    const match =
      SCENARIOS.find((s) => key.includes("договор") && s.chip.includes("договор")) ||
      SCENARIOS.find((s) => key.includes("письм") && s.chip.includes("письмо")) ||
      SCENARIOS.find((s) => (key.includes("встреч") || key.includes("календ")) && s.chip.includes("встречу")) ||
      SCENARIOS.find((s) => (key.includes("отчёт") || key.includes("отчет") || key.includes("аналит")) && s.chip.includes("отчёт"));
    if (match) {
      runScenario({ ...match, query: q });
    } else {
      // Неизвестный запрос — просто покажем удивление
      setMessages((m) => [
        ...m,
        { kind: "user", text: q },
        {
          kind: "ai",
          text: "Хм, в демо у меня только 4 сценария (договор / письмо / встреча / отчёт). В реальной платформе — сотни. Попробуйте кнопки ниже 👇",
          revealed: 0,
          steps: [],
        },
      ]);
      schedule(() => {
        mascot.fire("pensive");
        const text = "Хм, в демо у меня только 4 сценария (договор / письмо / встреча / отчёт). В реальной платформе — сотни. Попробуйте кнопки ниже 👇";
        for (let i = 1; i <= text.length; i++) {
          schedule(() => updateLastAi({ revealed: i }), i * STREAM_SPEED);
        }
      }, 300);
    }
  };

  return (
    <>
      <div
        className="rounded-[20px] border border-border bg-card overflow-hidden"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 16px 48px rgba(2,89,221,0.06)" }}
      >
        {/* header — живой Оффи */}
        <div className="flex items-center gap-3 px-[18px] py-3 border-b border-[hsl(var(--border-light))]">
          <div className="shrink-0 relative">
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(closest-side, hsl(var(--accent-brand-light)), transparent 70%)" }}
              aria-hidden
            />
            <GuestMascot
              size={40}
              state={mascot.props.state}
              oneshotId={mascot.props.oneshotId}
              oneshotKey={mascot.props.oneshotKey}
              animated
            />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Оффи</div>
            <div className="flex items-center gap-1.5">
              <span
                className={
                  "w-1.5 h-1.5 rounded-full " +
                  (busy ? "bg-primary animate-pulse" : "bg-[hsl(var(--success))]")
                }
              />
              <span className="text-[11px] text-[hsl(var(--text-tertiary))]">
                {busy ? "работаю…" : "онлайн"}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-wider font-semibold">
            DEMO
          </span>
        </div>

        {/* messages */}
        <div ref={scroller} className="p-[18px] min-h-[260px] max-h-[360px] overflow-y-auto no-scrollbar">
          {messages.map((m, i) => (
            <div key={i}>
              {m.kind === "ai-greeting" && <GreetingBubble text={m.text} />}
              {m.kind === "user" && <UserBubble text={m.text} />}
              {m.kind === "ai" && <AiBubble msg={m} onConfirm={() => onConfirm(i)} />}
            </div>
          ))}
        </div>

        {/* composer */}
        <div className="px-[18px] py-3 border-t border-[hsl(var(--border-light))] flex gap-2 items-center">
          <Paperclip className="w-4 h-4 text-[hsl(var(--text-tertiary))] shrink-0" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder={busy ? "Оффи отвечает…" : "Напишите задачу или выберите пример…"}
            className="flex-1 h-10 text-[13px]"
            disabled={busy}
          />
          <button
            onClick={onSend}
            className="w-10 h-10 rounded-[10px] grid place-items-center text-lg transition-all disabled:opacity-60"
            disabled={!input.trim() || busy}
            style={{
              background: input.trim() && !busy ? "hsl(var(--accent-brand))" : "hsl(var(--surface-alt))",
              color: input.trim() && !busy ? "#fff" : "hsl(var(--text-tertiary))",
            }}
            aria-label="Отправить"
          >
            ↑
          </button>
        </div>
      </div>

      {/* chips */}
      <div className="flex gap-2 mt-3.5 flex-wrap justify-center">
        {SCENARIOS.map((s) => (
          <button
            key={s.chip}
            onClick={() => runScenario(s)}
            disabled={busy}
            className="btn-bounce px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-[hsl(var(--accent-brand-light))] disabled:opacity-50 disabled:pointer-events-none"
          >
            {s.chip}
          </button>
        ))}
      </div>
    </>
  );
}

function GreetingBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 mb-3.5 anim-slide-right">
      <div className="w-[30px] h-[30px] rounded-full bg-[hsl(var(--accent-brand-light))] grid place-items-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="px-3.5 py-2.5 rounded-[14px] rounded-tl-[4px] bg-[hsl(var(--accent-brand-light))] text-[13px] text-foreground">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 mb-3.5 flex-row-reverse anim-slide-left">
      <div className="w-[30px] h-[30px] rounded-full grid place-items-center text-[12px] font-bold shrink-0 bg-[hsl(var(--surface-alt))] text-foreground">
        Вы
      </div>
      <div className="px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground max-w-[300px] bg-card border border-border rounded-[14px] rounded-tr-[4px]">
        {text}
      </div>
    </div>
  );
}

function AiBubble({ msg, onConfirm }: { msg: Extract<Msg, { kind: "ai" }>; onConfirm: () => void }) {
  const shownText = msg.text.slice(0, msg.revealed);
  const streaming = msg.revealed < msg.text.length;
  const showDots = msg.revealed === 0 && msg.steps.length === 0;

  return (
    <div className="flex gap-2.5 mb-3.5 anim-slide-right">
      <div className="w-[30px] h-[30px] rounded-full bg-[hsl(var(--accent-brand-light))] grid place-items-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 max-w-[320px] space-y-2">
        <div className="px-3.5 py-2.5 rounded-[14px] rounded-tl-[4px] bg-[hsl(var(--accent-brand-light))] text-[13px] leading-[1.55] text-foreground">
          {showDots ? (
            <TypingDots />
          ) : (
            <span>
              {shownText}
              {streaming && (
                <span className="inline-block w-[1.5px] h-[14px] bg-primary/70 ml-0.5 align-middle animate-pulse" />
              )}
            </span>
          )}
        </div>

        {msg.steps.length > 0 && (
          <div className="rounded-xl border border-[hsl(var(--border-light))] bg-card/60 px-3 py-2 space-y-1.5">
            {msg.steps.map((s, i) => (
              <StepLine key={i} step={s.step} status={s.status} />
            ))}
          </div>
        )}

        {msg.result && <ResultCardView card={msg.result} />}

        {msg.sources && msg.sources.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--text-tertiary))] px-1 flex-wrap anim-fade-in">
            <span>Источники:</span>
            {msg.sources.map((s) => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-[hsl(var(--surface-alt))] font-medium">
                {s}
              </span>
            ))}
          </div>
        )}

        {msg.confirm && (
          <ConfirmRow confirm={msg.confirm} chosen={msg.confirmChosen} onPrimary={onConfirm} />
        )}
      </div>
    </div>
  );
}

function StepLine({ step, status }: { step: ActionStep; status: "run" | "done" }) {
  const Icon = stepIcon(step.icon);
  return (
    <div className="flex items-center gap-2 text-[12px] text-foreground anim-fade-in">
      <span
        className={
          "w-5 h-5 rounded-full grid place-items-center shrink-0 transition-colors " +
          (status === "done" ? "bg-[hsl(var(--success))] text-white" : "bg-primary/10 text-primary")
        }
      >
        {status === "done" ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
      </span>
      <span className={status === "done" ? "text-muted-foreground" : "text-foreground"}>
        {status === "done" && step.doneText ? step.doneText : step.text}
      </span>
      {status === "run" && <LoadingDots />}
    </div>
  );
}

function stepIcon(k: ActionStep["icon"]) {
  switch (k) {
    case "search":
      return Search;
    case "doc":
      return FileText;
    case "mail":
      return Mail;
    case "cal":
      return CalendarDays;
    case "chart":
      return BarChart3;
    case "spark":
      return Sparkles;
  }
}

function ResultCardView({ card }: { card: ResultCard }) {
  if (card.kind === "doc") {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-3 anim-scale-in">
        <div className="w-9 h-11 rounded bg-[hsl(var(--accent-brand-light))] grid place-items-center text-primary">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground truncate">{card.name}</div>
          <div className="text-[11px] text-[hsl(var(--text-tertiary))] truncate">
            {card.hint} · {card.size}
          </div>
        </div>
      </div>
    );
  }
  if (card.kind === "mail") {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden anim-scale-in">
        <div className="px-3 py-2 bg-[hsl(var(--surface-alt))] border-b border-[hsl(var(--border-light))] text-[11px] text-muted-foreground">
          Кому: <span className="text-foreground font-medium">{card.to}</span>
        </div>
        <div className="px-3 py-2">
          <div className="text-[13px] font-semibold text-foreground mb-1">{card.subject}</div>
          <div className="text-[12px] text-muted-foreground leading-[1.5] line-clamp-2">{card.preview}</div>
        </div>
      </div>
    );
  }
  if (card.kind === "meeting") {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-3 flex items-center gap-3 anim-scale-in">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent-brand-light))] grid place-items-center text-primary shrink-0">
          <CalendarDays className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground">{card.title}</div>
          <div className="text-[11px] text-[hsl(var(--text-tertiary))]">
            {card.when} · {card.people.join(", ")}
          </div>
        </div>
      </div>
    );
  }
  if (card.kind === "stats") {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-3 grid grid-cols-3 gap-2 anim-scale-in">
        {card.items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="text-[15px] font-extrabold text-foreground tracking-tight">{it.value}</div>
            <div className="text-[10px] text-[hsl(var(--text-tertiary))] mt-0.5">{it.label}</div>
            {it.delta && (
              <div className="text-[10px] text-[hsl(var(--success))] font-semibold mt-0.5">{it.delta}</div>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function ConfirmRow({
  confirm,
  chosen,
  onPrimary,
}: {
  confirm: NonNullable<Scenario["confirm"]>;
  chosen?: "primary";
  onPrimary: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5 anim-fade-in">
      <button
        onClick={onPrimary}
        disabled={!!chosen}
        className={
          "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all btn-bounce " +
          (chosen === "primary"
            ? "bg-[hsl(var(--success))] text-white"
            : "bg-primary text-white shadow-[0_4px_14px_-4px_rgba(2,89,221,0.45)]")
        }
      >
        {chosen === "primary" ? (
          <span className="inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Выполнено
          </span>
        ) : (
          confirm.primary
        )}
      </button>
      <button
        disabled={!!chosen}
        className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-foreground bg-card border border-border disabled:opacity-50"
      >
        {confirm.secondary}
      </button>
      <span className="text-[11px] text-[hsl(var(--text-tertiary))]">{confirm.hint}</span>
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

function LoadingDots() {
  return (
    <span className="inline-flex gap-[3px] items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] h-[3px] rounded-full bg-primary/60"
          style={{ animation: `dot-bounce 1s ${i * 0.12}s infinite` }}
        />
      ))}
    </span>
  );
}
