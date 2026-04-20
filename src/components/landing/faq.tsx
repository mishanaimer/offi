"use client";

import { useState } from "react";
import { Reveal } from "./reveal";

const ITEMS = [
  { q: "Безопасно ли загружать документы?", a: "Да. Все данные хранятся на серверах в РФ с шифрованием. Мы не используем ваши данные для обучения моделей. Соответствуем 152-ФЗ." },
  { q: "Сколько времени занимает настройка?", a: "Базовая настройка — 5 минут. Загрузите документы, подключите почту и календарь — Offi готов к работе." },
  { q: "Можно ли подключить свою CRM?", a: "Да, поддерживаем интеграции с Битрикс24, amoCRM, а также API для любой системы." },
  { q: "Что если AI ошибётся?", a: "Offi всегда спрашивает подтверждение перед отправкой. Вы контролируете каждое действие." },
];

export function LandingFaq() {
  return (
    <section id="faq" className="max-w-[580px] mx-auto px-6 md:px-8 pt-[88px]">
      <Reveal>
        <div className="text-center mb-10">
          <p className="text-[13px] font-semibold text-primary mb-2">FAQ</p>
          <h2 className="text-[28px] font-extrabold text-foreground tracking-[-0.03em]">
            Частые вопросы
          </h2>
        </div>
      </Reveal>
      {ITEMS.map((item, i) => (
        <Reveal key={i} delay={i * 60}>
          <FaqItem {...item} />
        </Reveal>
      ))}
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen((v) => !v)}
      className="cursor-pointer border-b border-[hsl(var(--border-light))]"
    >
      <div className="py-[18px] flex justify-between items-center">
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <span
          className="text-lg text-[hsl(var(--text-tertiary))] font-light shrink-0 ml-4 inline-block transition-transform duration-300"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0)", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >+</span>
      </div>
      <div
        className="overflow-hidden transition-all duration-[400ms]"
        style={{
          maxHeight: open ? 200 : 0,
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <p className="text-[13px] text-muted-foreground leading-[1.65] pb-[18px]">{a}</p>
      </div>
    </div>
  );
}
