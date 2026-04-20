import { Reveal } from "./reveal";

const FEATURES = [
  { emoji: "🧠", title: "Знает контекст", desc: "Загрузите документы, прайсы, шаблоны — Offi запомнит всё и будет использовать" },
  { emoji: "⚡", title: "Действует", desc: "Не просто отвечает — отправляет письма, создаёт документы, ведёт календарь" },
  { emoji: "🔒", title: "Безопасно", desc: "Данные хранятся в РФ. Шифрование end-to-end. Соответствие 152-ФЗ" },
  { emoji: "🔗", title: "Интеграции", desc: "Почта, Google Calendar, CRM, Telegram — подключается за минуты" },
  { emoji: "👥", title: "Для команды", desc: "Общая база знаний, роли и доступы. Подходит для 3–50 сотрудников" },
  { emoji: "📈", title: "Учится", desc: "Запоминает ваш стиль общения и предпочтения. Становится лучше каждый день" },
];

export function LandingFeatures() {
  return (
    <section id="features" className="max-w-[760px] mx-auto px-6 md:px-8 pt-[88px]">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[13px] font-semibold text-primary mb-2">Возможности</p>
          <h2 className="text-[30px] md:text-[32px] font-extrabold text-foreground leading-[1.15] tracking-[-0.035em]">
            Один ассистент —<br />вместо десятка сервисов
          </h2>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 70}>
            <div className="card-hover h-full p-6 rounded-[14px] bg-card border border-border hover:border-[hsl(var(--accent-brand-mid))]">
              <div className="text-[28px] mb-3.5">{f.emoji}</div>
              <div className="text-sm font-semibold text-foreground mb-1.5 tracking-[-0.01em]">{f.title}</div>
              <div className="text-[13px] text-muted-foreground leading-[1.6]">{f.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
