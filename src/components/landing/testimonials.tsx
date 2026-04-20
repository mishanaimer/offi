import { Reveal } from "./reveal";

const ITEMS = [
  { text: "Offi заменил нам секретаря и половину CRM. За неделю подготовил 30+ договоров без единой ошибки.", name: "Анна К.", role: "Директор, дизайн-студия", avatar: "А" },
  { text: "Наконец-то AI, который реально делает, а не просто советует. Подключили за 10 минут, команда пользуется каждый день.", name: "Михаил Р.", role: "Основатель, IT-агентство", avatar: "М" },
  { text: "Особенно нравится работа с клиентской базой — находит нужного клиента за секунду и сразу предлагает действия.", name: "Елена С.", role: "Менеджер, торговая компания", avatar: "Е" },
  { text: "Экономим ~8 часов в неделю на рутине. Рассылки, документы, отчёты — теперь это одна строка в чате. 🔥", name: "Дмитрий В.", role: "CEO, логистика", avatar: "Д" },
];

export function LandingTestimonials() {
  return (
    <section className="max-w-[760px] mx-auto px-6 md:px-8 pt-[88px]">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[13px] font-semibold text-primary mb-2">Отзывы</p>
          <h2 className="text-[30px] md:text-[32px] font-extrabold text-foreground tracking-[-0.035em]">
            Что говорят клиенты
          </h2>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ITEMS.map((t, i) => (
          <Reveal key={t.name} delay={i * 80} from={i % 2 === 0 ? "left" : "right"}>
            <div className="card-hover h-full p-6 rounded-2xl bg-card border border-border">
              <div className="text-[13px] text-foreground leading-[1.65] mb-4">&ldquo;{t.text}&rdquo;</div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[hsl(var(--accent-brand-light))] text-primary font-bold text-[13px] grid place-items-center">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                  <div className="text-[11px] text-[hsl(var(--text-tertiary))]">{t.role}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
