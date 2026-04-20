import { Logo } from "@/components/logo";

const COLUMNS = [
  { title: "Продукт", links: ["Возможности", "Тарифы", "Интеграции", "API"] },
  { title: "Компания", links: ["О нас", "Блог", "Вакансии", "Контакты"] },
  { title: "Поддержка", links: ["Документация", "Обучение", "Статус", "Безопасность"] },
];

export function LandingFooter() {
  return (
    <footer className="max-w-[800px] mx-auto px-6 md:px-8 mt-[88px] pb-12">
      <div className="border-t border-border pt-10">
        <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 mb-10">
          <div>
            <Logo size={18} className="mb-2.5" />
            <p className="text-[13px] text-muted-foreground leading-[1.6] mb-4 max-w-[260px]">
              AI-ассистент для бизнеса. Документы, клиенты, задачи — в одном чате.
            </p>
            <div className="flex gap-2">
              {["TG", "VK", "YT"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="btn-bounce w-8 h-8 rounded-lg bg-[hsl(var(--surface-alt))] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border-light))] grid place-items-center text-[10px] font-bold hover:bg-[hsl(var(--accent-brand-light))] hover:text-primary hover:border-[hsl(var(--accent-brand-mid))]"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold text-foreground mb-3.5">{col.title}</div>
              {col.links.map((l) => (
                <a
                  key={l}
                  href="#"
                  className="link-hover block text-[13px] text-muted-foreground mb-2.5"
                >{l}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-[hsl(var(--border-light))] pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs text-[hsl(var(--text-tertiary))]">© 2026 offi.ai · Москва, Россия</span>
          <div className="flex gap-4">
            {["Конфиденциальность", "Условия", "Cookies"].map((l) => (
              <a key={l} href="#" className="link-hover text-xs text-[hsl(var(--text-tertiary))]">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
