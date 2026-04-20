"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { q: "Это безопасно? Мои документы не утекут?",
    a: "Данные хранятся в Supabase с Row Level Security — другие компании физически не видят ваши файлы. LLM-запросы идут через RouterAI и не используются для обучения моделей." },
  { q: "Какие файлы можно загружать?",
    a: "PDF, DOCX, XLSX, CSV, TXT и любые URL. Мы автоматически парсим текст, разбиваем на чанки и создаём векторные embeddings." },
  { q: "Нужен ли VPN для работы?",
    a: "Нет. Мы используем RouterAI.ru — российский шлюз к DeepSeek и Claude. Оплата рублями, без VPN." },
  { q: "Кто такой Оффи? Можно переименовать?",
    a: "Оффи — дефолтное имя ассистента. В настройках вы можете задать своё: ДентОпт → Денти, АйСистемс → Айли." },
  { q: "Интегрируется ли с AmoCRM / Bitrix24 / 1С?",
    a: "Да. На тарифе «Бизнес» — AmoCRM и Bitrix24, на «Команде» — дополнительно 1С (OData) и публичный API." },
  { q: "Как считается один запрос?",
    a: "Один запрос = одно сообщение пользователя. Действия (отправка письма, создание встречи) считаются отдельно — есть свой лимит." },
];

export function LandingFaq() {
  return (
    <section id="faq" className="py-20 md:py-28 border-t border-border">
      <div className="container-page max-w-3xl">
        <div className="text-sm text-primary font-medium">Частые вопросы</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Что спрашивают чаще всего</h2>
        <div className="mt-10 space-y-3">
          {ITEMS.map((item, i) => <FaqItem key={i} {...item} />)}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("card-surface overflow-hidden transition", open && "shadow-[var(--shadow-sm)]")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-medium pr-4">{q}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}
