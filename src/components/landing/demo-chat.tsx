"use client";

// DemoChat — живой пример работы Offi на лендинге. Автоплей: пользователь
// «печатает» запрос → AI отвечает стримом → появляются шаги действия
// (ищу клиента, генерирую документ…) → файл/письмо/отчёт → кнопка подтверждения.
// Цель — за 10–15 секунд показать, что это не «чат с фактами», а агент,
// который делает реальные дела.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OffiMark } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Check, FileText, Mail, CalendarDays, BarChart3, Search, Sparkles, Paperclip } from "lucide-react";

type ActionStep = {
  icon: "search" | "doc" | "mail" | "cal" | "chart" | "spark";
  text: string;
  doneText?: string;
  durMs: number; // сколько висит в «in-progress» перед ✅
};

type ResultCard =
  | { kind: "doc"; name: string; size: string; hint: string }
  | { kind: "mail"; to: string; subject: string; preview: string }
  | { kind: "meeting"; title: string; when: string; people: string[] }
  | { kind: "stats"; items: { label: string; value: string; delta?: string }[] };

type Scenario = {
  query: string;          // что пользователь «пишет»
  reply: string;          // стрим AI
  sources?: string[];     // цитаты источников (под AI-бабблом)
  steps: ActionStep[];    // шаги действия
  result?: ResultCard;
  confirm?: { primary: string; secondary: string; hint: string };
};

const SCENARIOS: Scenario[] = [
  {
    query: "Подготовь договор для ООО «Вектор»",
    reply: "Готовлю договор по шаблону «Услуги». Реквизиты беру из базы клиентов.",
    sources: ["база-клиентов.xlsx", "шаблон-договора-услуги.docx"],
    steps: [
      { icon: "search", text: "Ищу клиента «ООО Вектор» в базе…", doneText: "Нашла: ООО «Вектор», ИНН 7701234567", durMs: 900 },
      { icon: "doc", text: "Генерирую договор №48 по шаблону «Услуги»…", doneText: "Договор №48 готов", durMs: 1100 },
    ],
    result: { kind: "doc", name: "Договор №48.docx", size: "28 КБ", hint: "Сумма: 150 000 ₽ · Срок: 30 дней" },
    confirm: { primary: "Отправить на подпись", secondary: "Открыть", hint: "отправит в СБИС от вашего имени" },
  },
  {
    query: "Напиши письмо Иванову — перенести встречу на завтра",
    reply: "Черновик готов. Тон — деловой, но тёплый. Можно отправить или подправить.",
    steps: [
      { icon: "mail", text: "Готовлю черновик письма…", doneText: "Письмо собрано", durMs: 1100 },
    ],
    result: {
      kind: "mail",
      to: "Иванов И.П. <ivanov@vector.ru>",
      subject: "Перенос встречи",
      preview: "Добрый день, Иван Петрович! Предлагаю перенести нашу встречу на завтра, 11:00. Если удобно — подтвердите.",
    },
    confirm: { primary: "Отправить", secondary: "Изменить", hint: "отправится через ваш корпоративный ящик" },
  },
  {
    query: "Назначь встречу с Петровой на этой неделе",
    reply: "Нашла свободный слот у вас обоих — пятница, 14:00. Длительность — 30 минут.",
    steps: [
      { icon: "cal", text: "Синхронизирую календари…", doneText: "Окно найдено", durMs: 1000 },
    ],
    result: {
      kind: "meeting",
      title: "Встреча с Петровой",
      when: "Пт, 14:00 — 14:30",
      people: ["Вы", "Петрова М.С."],
    },
    confirm: { primary: "Создать встречу", secondary: "Другое время", hint: "добавится в Google Calendar + Telemost" },
  },
  {
    query: "Покажи отчёт по продажам за апрель",
    reply: "Собрала данные из CRM. Апрель — рекордный месяц по выручке.",
    sources: ["amoCRM.сделки-апрель", "аналитика-2026.pdf"],
    steps: [
      { icon: "chart", text: "Строю отчёт…", doneText: "Отчёт собран", durMs: 900 },
    ],
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
  | { kind: "ai"; text: string; revealed: number; sources?: string[]; steps: { step: ActionStep; status: "run" | "done" }[]; result?: ResultCard; confirm?: Scenario["confirm"]; confirmChosen?: "primary" | "secondary" };

const STREAM_SPEED = 18;   // ms на символ (лёгкий стрим)
const USER_TYPE_SPEED = 45;
const PAUSE_BETWEEN = 1400;

export function DemoChat() {
  const [messages, setMessages] = useState<Msg[]>([
    { kind: "ai-greeting", text: "Привет! Я — Offi. Смотрите, что я умею 👇" },
  ]);
  const [userInput, setUserInput] = useState("");
  const [autoplayOn, setAutoplayOn] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const scenarioIdx = useRef(0);

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
  }, [messages, userInput]);

  const runScenario = useCallback(
    (s: Scenario) => {
      clearTimers();

      // 1. Пользователь «печатает» запрос
      setUserInput("");
      const chars = s.query.split("");
      chars.forEach((_, i) => {
        schedule(() => setUserInput(s.query.slice(0, i + 1)), (i + 1) * USER_TYPE_SPEED);
      });

      // 2. «Отправка» — добавляем user msg и очищаем инпут
      const sendAt = chars.length * USER_TYPE_SPEED + 380;
      schedule(() => {
        setUserInput("");
        setMessages((m) => [...m, { kind: "user", text: s.query }]);
      }, sendAt);

      // 3. AI — typing dots
      schedule(() => {
        setMessages((m) => [
          ...m,
          {
            kind: "ai",
            text: s.reply,
            revealed: 0,
            steps: [],
            sources: undefined,
            result: undefined,
            confirm: undefined,
          },
        ]);
      }, sendAt + 550);

      // 4. Стрим ответа
      const streamStart = sendAt + 1200;
      const replyChars = s.reply.length;
      for (let i = 1; i <= replyChars; i++) {
        schedule(() => {
          setMessages((m) => {
            const next = [...m];
            const idx = next.findIndex((x) => x.kind === "ai" && x.revealed < replyChars);
            if (idx === -1) return m;
            next[idx] = { ...(next[idx] as Extract<Msg, { kind: "ai" }>), revealed: i };
            return next;
          });
        }, streamStart + i * STREAM_SPEED);
      }

      // 5. Шаги действия — по очереди
      let cursor = streamStart + replyChars * STREAM_SPEED + 200;
      const updateAi = (patch: Partial<Extract<Msg, { kind: "ai" }>>) =>
        setMessages((m) => {
          const next = [...m];
          const idx = [...next].reverse().findIndex((x) => x.kind === "ai");
          if (idx === -1) return m;
          const realIdx = next.length - 1 - idx;
          next[realIdx] = { ...(next[realIdx] as Extract<Msg, { kind: "ai" }>), ...patch };
          return next;
        });

      s.steps.forEach((step, i) => {
        schedule(() => {
          setMessages((m) => {
            const next = [...m];
            const ridx = [...next].reverse().findIndex((x) => x.kind === "ai");
            const realIdx = next.length - 1 - ridx;
            const ai = next[realIdx] as Extract<Msg, { kind: "ai" }>;
            const steps = [...ai.steps, { step, status: "run" as const }];
            next[realIdx] = { ...ai, steps };
            return next;
          });
        }, cursor);
        cursor += step.durMs;
        schedule(() => {
          setMessages((m) => {
            const next = [...m];
            const ridx = [...next].reverse().findIndex((x) => x.kind === "ai");
            const realIdx = next.length - 1 - ridx;
            const ai = next[realIdx] as Extract<Msg, { kind: "ai" }>;
            const steps = ai.steps.map((st, j) => (j === i ? { ...st, status: "done" as const } : st));
            next[realIdx] = { ...ai, steps };
            return next;
          });
        }, cursor);
        cursor += 200;
      });

      // 6. Результат — карточка
      if (s.result) {
        schedule(() => updateAi({ result: s.result }), cursor);
        cursor += 400;
      }

      // 7. Источники
      if (s.sources) {
        schedule(() => updateAi({ sources: s.sources }), cursor);
        cursor += 250;
      }

      // 8. Confirm-кнопки
      if (s.confirm) {
        schedule(() => updateAi({ confirm: s.confirm }), cursor);
        cursor += 900;
      }

      // 9. Авто-click на подтверждение и переход к следующему сценарию
      if (s.confirm) {
        schedule(() => {
          updateAi({ confirmChosen: "primary" });
        }, cursor + 800);
        cursor += 1500;
      }

      // 10. Следующий сценарий
      schedule(() => {
        scenarioIdx.current = (scenarioIdx.current + 1) % SCENARIOS.length;
        setMessages((m) => (m.length > 9 ? m.slice(-6) : m));
        if (autoplayOn) runScenario(SCENARIOS[scenarioIdx.current]);
      }, cursor + PAUSE_BETWEEN);
    },
    [autoplayOn, clearTimers, schedule]
  );

  useEffect(() => {
    if (!autoplayOn) return;
    const id = window.setTimeout(() => runScenario(SCENARIOS[scenarioIdx.current]), 900);
    return () => {
      window.clearTimeout(id);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayOn]);

  const handleChipClick = (i: number) => {
    setAutoplayOn(false);
    clearTimers();
    scenarioIdx.current = i;
    runScenario(SCENARIOS[i]);
  };

  const chips = useMemo(
    () => [
      { label: "📄 Подготовь договор", idx: 0 },
      { label: "✉️ Напиши письмо", idx: 1 },
      { label: "📅 Назначь встречу", idx: 2 },
      { label: "📊 Покажи отчёт", idx: 3 },
    ],
    []
  );

  return (
    <>
      <div
        className="rounded-[20px] border border-border bg-card overflow-hidden"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 16px 48px rgba(2,89,221,0.06)" }}
      >
        {/* header */}
        <div className="flex items-center gap-2.5 px-[18px] py-3 border-b border-[hsl(var(--border-light))]">
          <OffiMark size={34} />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Offi</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse" />
              <span className="text-[11px] text-[hsl(var(--text-tertiary))]">Онлайн · показываю, как работаю</span>
            </div>
          </div>
          <span className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-wider font-semibold">DEMO</span>
        </div>

        {/* messages */}
        <div ref={scroller} className="p-[18px] min-h-[320px] max-h-[380px] overflow-y-auto no-scrollbar">
          {messages.map((m, i) => (
            <div key={i}>
              {m.kind === "ai-greeting" && <GreetingBubble text={m.text} />}
              {m.kind === "user" && <UserBubble text={m.text} />}
              {m.kind === "ai" && <AiBubble msg={m} />}
            </div>
          ))}
        </div>

        {/* composer — во время автоплея показываем фантомный набор */}
        <div className="px-[18px] py-3 border-t border-[hsl(var(--border-light))] flex gap-2 items-center">
          <Paperclip className="w-4 h-4 text-[hsl(var(--text-tertiary))] shrink-0" />
          <Input
            value={userInput}
            onChange={(e) => {
              setAutoplayOn(false);
              clearTimers();
              setUserInput(e.target.value);
            }}
            placeholder="Напишите задачу…"
            className="flex-1 h-10 text-[13px]"
            readOnly={autoplayOn}
          />
          <button
            className="w-10 h-10 rounded-[10px] grid place-items-center text-lg transition-all"
            style={{
              background: userInput.trim() ? "hsl(var(--accent-brand))" : "hsl(var(--surface-alt))",
              color: userInput.trim() ? "#fff" : "hsl(var(--text-tertiary))",
            }}
            aria-label="Отправить"
          >↑</button>
        </div>
      </div>

      {/* chips */}
      <div className="flex gap-2 mt-3.5 flex-wrap justify-center">
        {chips.map((c, i) => (
          <button
            key={c.label}
            onClick={() => handleChipClick(c.idx)}
            className="btn-bounce px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-[hsl(var(--accent-brand-light))]"
          >
            {c.label}
          </button>
        ))}
      </div>
    </>
  );
}

function GreetingBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 mb-3.5 anim-slide-right">
      <OffiMark size={30} />
      <div className="px-3.5 py-2.5 rounded-[14px] rounded-tl-[4px] bg-[hsl(var(--accent-brand-light))] text-[13px] text-foreground">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 mb-3.5 flex-row-reverse anim-slide-left">
      <div className="w-[30px] h-[30px] rounded-full grid place-items-center text-[12px] font-bold shrink-0 bg-[hsl(var(--surface-alt))] text-foreground">Вы</div>
      <div className="px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground max-w-[360px] bg-card border border-border rounded-[14px] rounded-tr-[4px]">
        {text}
      </div>
    </div>
  );
}

function AiBubble({ msg }: { msg: Extract<Msg, { kind: "ai" }> }) {
  const shownText = msg.text.slice(0, msg.revealed);
  const streaming = msg.revealed < msg.text.length;
  const showDots = msg.revealed === 0 && msg.steps.length === 0;

  return (
    <div className="flex gap-2.5 mb-3.5 anim-slide-right">
      <OffiMark size={30} />
      <div className="max-w-[400px] space-y-2 min-w-0">
        {/* основной ответ */}
        <div className="px-3.5 py-2.5 rounded-[14px] rounded-tl-[4px] bg-[hsl(var(--accent-brand-light))] text-[13px] leading-[1.55] text-foreground">
          {showDots ? (
            <TypingDots />
          ) : (
            <span>
              {shownText}
              {streaming && <span className="inline-block w-[1.5px] h-[14px] bg-primary/70 ml-0.5 align-middle animate-pulse" />}
            </span>
          )}
        </div>

        {/* шаги действия */}
        {msg.steps.length > 0 && (
          <div className="rounded-xl border border-[hsl(var(--border-light))] bg-card/60 px-3 py-2 space-y-1.5">
            {msg.steps.map((s, i) => (
              <StepLine key={i} step={s.step} status={s.status} />
            ))}
          </div>
        )}

        {/* результат */}
        {msg.result && <ResultCardView card={msg.result} />}

        {/* источники */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--text-tertiary))] px-1 flex-wrap anim-fade-in">
            <span>Источники:</span>
            {msg.sources.map((s) => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-[hsl(var(--surface-alt))] font-medium">{s}</span>
            ))}
          </div>
        )}

        {/* confirm */}
        {msg.confirm && <ConfirmRow confirm={msg.confirm} chosen={msg.confirmChosen} />}
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
    case "search": return Search;
    case "doc": return FileText;
    case "mail": return Mail;
    case "cal": return CalendarDays;
    case "chart": return BarChart3;
    case "spark": return Sparkles;
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
          <div className="text-[11px] text-[hsl(var(--text-tertiary))] truncate">{card.hint} · {card.size}</div>
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
          <div className="text-[11px] text-[hsl(var(--text-tertiary))]">{card.when} · {card.people.join(", ")}</div>
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
            {it.delta && <div className="text-[10px] text-[hsl(var(--success))] font-semibold mt-0.5">{it.delta}</div>}
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
}: {
  confirm: NonNullable<Scenario["confirm"]>;
  chosen?: "primary" | "secondary";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5 anim-fade-in">
      <button
        className={
          "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all btn-bounce " +
          (chosen === "primary"
            ? "bg-[hsl(var(--success))] text-white"
            : "bg-primary text-white shadow-[0_4px_14px_-4px_rgba(2,89,221,0.45)]")
        }
      >
        {chosen === "primary" ? (
          <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Выполнено</span>
        ) : (
          confirm.primary
        )}
      </button>
      <button className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-foreground bg-card border border-border">
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
