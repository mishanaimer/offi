import Link from "next/link";
import { ChevronLeft, FileText, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { listLegalDocs } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Юридическая информация — Offi",
  description:
    "Оферта, политика обработки персональных данных, cookies, DPA. Все документы Offi в соответствии с законодательством РФ.",
};

const DOC_DESCRIPTIONS: Record<string, string> = {
  offer: "Условия оказания услуг, тарифы, ответственность сторон.",
  privacy: "Какие данные мы собираем, как храним, кому передаём, как удалить.",
  cookies: "Какие cookie использует сайт и как ими управлять.",
  dpa: "Соглашение об обработке ПДн ваших клиентов в Offi.",
};

export default function LegalIndexPage() {
  const docs = listLegalDocs();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[hsl(var(--border-light))] bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={16} />
            На главную
          </Link>
          <Logo size={17} />
          <div className="w-[88px]" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-6 py-12">
        <div className="mb-12">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-primary">
            Документация
          </p>
          <h1 className="text-[40px] font-extrabold tracking-[-0.025em] leading-[1.1] text-foreground">
            Юридическая информация
          </h1>
          <p className="mt-4 max-w-[560px] text-[15px] leading-[1.6] text-muted-foreground">
            Все документы Offi в соответствии с законодательством Российской Федерации.
            Каждый документ можно открыть онлайн и сохранить в PDF — кнопка «Скачать PDF» справа на странице.
          </p>
        </div>

        <div className="grid gap-3">
          {docs.map((doc) => (
            <Link
              key={doc.slug}
              href={`/legal/${doc.slug}`}
              className="group flex items-start gap-4 rounded-2xl border border-[hsl(var(--border))] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_30px_-15px_rgba(2,89,221,0.25)]"
            >
              <div className="mt-1 grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent-brand-light))] text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-foreground group-hover:text-primary">
                    {doc.title}
                  </h2>
                  <ArrowUpRight
                    size={16}
                    className="text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-foreground">
                  {DOC_DESCRIPTIONS[doc.slug] ?? ""}
                </p>
                {doc.updated && (
                  <p className="mt-2 text-[11px] text-[hsl(var(--text-tertiary))]">
                    Редакция от {doc.updated}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[hsl(var(--border-light))] bg-[hsl(var(--accent-brand-light))]/40 p-6">
          <h3 className="text-[15px] font-semibold text-foreground">
            Вопросы о персональных данных?
          </h3>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-muted-foreground">
            Запросы по обработке персональных данных направляйте на{" "}
            <a
              href="mailto:privacy@offi-ai.com"
              className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
            >
              privacy@offi-ai.com
            </a>
            . Срок ответа — не более 30 дней с момента получения запроса согласно 152-ФЗ.
          </p>
        </div>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border-light))] pt-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Offi · offi-ai.com</span>
          <Link href="/docs" className="text-primary hover:underline">
            Документация продукта →
          </Link>
        </footer>
      </main>
    </div>
  );
}
