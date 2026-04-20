import { Reveal } from "./reveal";

const STEPS = [
  { step: "01", emoji: "📁", title: "Загрузите", desc: "Документы, шаблоны, прайсы, базу клиентов — всё что знает ваш бизнес" },
  { step: "02", emoji: "💬", title: "Спросите", desc: "Пишите задачи как коллеге: «подготовь договор», «напиши клиенту», «покажи аналитику»" },
  { step: "03", emoji: "✅", title: "Готово", desc: "Offi выполнит задачу: создаст документ, отправит письмо, назначит встречу" },
];

export function LandingHowItWorks() {
  return (
    <section id="how" className="max-w-[760px] mx-auto px-6 md:px-8 pt-[88px]">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[13px] font-semibold text-primary mb-2 tracking-[-0.01em]">Как это работает</p>
          <h2 className="text-[30px] md:text-[32px] font-extrabold text-foreground leading-[1.15] tracking-[-0.035em]">
            Три шага до результата
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.step} delay={i * 100}>
            <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-7 h-full">
              <div
                className="absolute top-3 right-4 text-[48px] font-extrabold leading-none select-none tracking-[-0.04em]"
                style={{ color: "hsl(var(--border-light))" }}
              >
                {s.step}
              </div>
              <div className="text-[32px] mb-4">{s.emoji}</div>
              <div className="text-base font-bold text-foreground mb-2 tracking-[-0.02em]">{s.title}</div>
              <div className="text-[13px] text-muted-foreground leading-[1.6]">{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
