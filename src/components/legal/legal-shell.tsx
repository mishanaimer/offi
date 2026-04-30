import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Logo } from "@/components/logo";
import type { LegalDoc } from "@/lib/legal-content";
import { listLegalDocs } from "@/lib/legal-content";
import { PrintButton } from "./print-button";
import { LegalWatermark } from "./legal-watermark";

export function LegalShell({ doc }: { doc: LegalDoc }) {
  const allDocs = listLegalDocs();
  return (
    <div className="legal-page relative min-h-screen bg-background">
      <LegalWatermark />

      {/* Top bar — скрывается при печати */}
      <header className="no-print sticky top-0 z-30 border-b border-[hsl(var(--border-light))] bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft size={16} />
            На главную
          </Link>
          <Logo size={17} />
          <PrintButton />
        </div>
      </header>

      {/* PDF-only header — печатная шапка с логотипом */}
      <div className="print-only mb-6">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
          <Logo size={20} />
          <span className="text-xs text-muted-foreground">offi-ai.com</span>
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-[820px] px-6 py-10 print:py-0">
        {/* Заглавный блок */}
        <div className="mb-8 print:mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-primary">
            Юридический документ
          </p>
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em] leading-[1.15] text-foreground print:text-[28px]">
            {doc.title}
          </h1>
          {doc.updated && (
            <p className="mt-3 text-sm text-muted-foreground">
              Редакция от {doc.updated}
            </p>
          )}
        </div>

        {/* Навигация по документам — скрыта при печати */}
        <nav className="no-print mb-10 flex flex-wrap gap-2">
          {allDocs.map((d) => (
            <Link
              key={d.slug}
              href={`/legal/${d.slug}`}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                d.slug === doc.slug
                  ? "border-primary bg-[hsl(var(--accent-brand-light))] text-primary"
                  : "border-[hsl(var(--border))] bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {shortTitle(d.title)}
            </Link>
          ))}
        </nav>

        {/* Контент — рендерится из markdown */}
        <article className="legal-prose">
          <ReactMarkdown
            components={{
              a: ({ href, children, ...rest }) => (
                <a
                  href={href}
                  className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                  {...rest}
                >
                  {children}
                </a>
              ),
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </article>

        {/* Футер документа */}
        <footer className="mt-16 border-t border-[hsl(var(--border-light))] pt-6 text-xs text-muted-foreground print:mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} Offi · offi-ai.com</span>
            <span className="print-only">{doc.title} · ред. {doc.updated}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function shortTitle(title: string): string {
  const map: Record<string, string> = {
    "Публичная оферта": "Оферта",
    "Политика обработки персональных данных": "Политика ПДн",
    "Политика использования файлов cookie": "Cookies",
    "Соглашение об обработке персональных данных (DPA)": "DPA",
  };
  return map[title] ?? title;
}
