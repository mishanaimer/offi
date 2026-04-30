import Link from "next/link";
import { Logo } from "@/components/logo";

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Продукт",
    links: [
      { label: "Возможности", href: "/#features" },
      { label: "Тарифы", href: "/#pricing" },
      { label: "Интеграции", href: "/docs#integrations" },
      { label: "Документация", href: "/docs" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "Связаться", href: "mailto:hello@offi-ai.com", external: true },
      { label: "Безопасность", href: "/docs#security" },
      { label: "Запросить пилот", href: "mailto:hello@offi-ai.com?subject=Пилот%20Offi", external: true },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { label: "Поддержка", href: "mailto:support@offi-ai.com", external: true },
      { label: "Запрос по ПДн", href: "mailto:privacy@offi-ai.com", external: true },
      { label: "Документы", href: "/legal" },
    ],
  },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Оферта", href: "/legal/offer" },
  { label: "Политика ПДн", href: "/legal/privacy" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "DPA", href: "/legal/dpa" },
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
              {[
                { s: "TG", href: "https://t.me/" },
                { s: "VK", href: "https://vk.com/" },
                { s: "YT", href: "https://youtube.com/" },
              ].map(({ s, href }) => (
                <a
                  key={s}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
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
              {col.links.map((l) =>
                l.external ? (
                  <a
                    key={l.label}
                    href={l.href}
                    className="link-hover block text-[13px] text-muted-foreground mb-2.5"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="link-hover block text-[13px] text-muted-foreground mb-2.5"
                  >
                    {l.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-[hsl(var(--border-light))] pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs text-[hsl(var(--text-tertiary))]">
            © {new Date().getFullYear()} offi-ai.com · Москва, Россия
          </span>
          <div className="flex flex-wrap gap-4">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="link-hover text-xs text-[hsl(var(--text-tertiary))]"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
