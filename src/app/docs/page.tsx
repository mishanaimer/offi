import Link from "next/link";
import type { Metadata } from "next";
import {
  ChevronLeft,
  Sparkles,
  BookOpen,
  Users,
  FileSignature,
  MessageSquare,
  ShieldCheck,
  Workflow,
  Plug,
  HelpCircle,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/legal/print-button";
import { LegalWatermark } from "@/components/legal/legal-watermark";

export const metadata: Metadata = {
  title: "Документация — Offi",
  description:
    "Что такое Offi, как устроен AI-ассистент для бизнеса, какие модули входят, как начать работу, где хранятся данные.",
};

const SECTIONS = [
  { id: "what", title: "Что такое Offi", icon: Sparkles },
  { id: "modules", title: "Модули продукта", icon: Workflow },
  { id: "how", title: "Как это работает", icon: BookOpen },
  { id: "start", title: "Как начать", icon: Users },
  { id: "documents", title: "Документы и шаблоны", icon: FileSignature },
  { id: "team", title: "Команда и роли", icon: MessageSquare },
  { id: "security", title: "Безопасность и данные", icon: ShieldCheck },
  { id: "integrations", title: "Интеграции", icon: Plug },
  { id: "faq", title: "Частые вопросы", icon: HelpCircle },
];

export default function DocsPage() {
  return (
    <div className="docs-page relative min-h-screen bg-background">
      <LegalWatermark />

      <header className="no-print sticky top-0 z-30 border-b border-[hsl(var(--border-light))] bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft size={16} />
            На главную
          </Link>
          <Logo size={17} />
          <PrintButton />
        </div>
      </header>

      <div className="print-only mb-6 px-6 pt-6">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
          <Logo size={20} />
          <span className="text-xs text-muted-foreground">Документация · offi-ai.com</span>
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-[1100px] px-6 py-12 print:py-0">
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          {/* Sidebar nav — скрыт при печати */}
          <aside className="no-print hidden lg:block">
            <nav className="sticky top-24 flex flex-col gap-1 text-[13.5px]">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                Содержание
              </p>
              {SECTIONS.map(({ id, title, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="group inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-[hsl(var(--accent-brand-light))] hover:text-primary"
                >
                  <Icon size={14} className="text-[hsl(var(--text-tertiary))] group-hover:text-primary" />
                  {title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="legal-prose docs-prose">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-primary">Документация</p>
            <h1 className="text-[40px] font-extrabold tracking-[-0.025em] leading-[1.1] text-foreground print:text-[28px]">
              Offi — AI-офис для бизнеса
            </h1>
            <p className="mt-4 max-w-[640px] text-[16px] leading-[1.65] text-muted-foreground">
              Внутренний AI-помощник для команды, который знает вашу компанию из документов и умеет действовать:
              отвечать клиентам, генерировать договоры, искать информацию, помогать всей команде в одном пространстве.
            </p>

            <section id="what" className="mt-14 scroll-mt-24">
              <h2>Что такое Offi</h2>
              <p>
                Offi — корпоративный AI-помощник для команд от 3 до 30 человек. Вы загружаете документы о компании
                (прайсы, регламенты, FAQ, шаблоны договоров), импортируете клиентов, и AI становится «сотрудником, который
                читал всё это» — отвечает на вопросы со ссылкой на источник, помогает с рутиной, поддерживает командный чат.
              </p>
              <p>
                В отличие от ChatGPT, Offi знает <em>именно вашу</em> компанию. В отличие от Chatbase / CustomGPT, у Offi
                встроенный CRM, командный чат и реальные действия (генерация договоров, поиск клиентов). В отличие от
                Microsoft Copilot, Offi работает в России, оплачивается рублями и заточен под малый и средний бизнес.
              </p>
            </section>

            <section id="modules" className="mt-14 scroll-mt-24">
              <h2>Модули продукта</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 list-none p-0">
                <FeatureCard
                  title="AI-чат с базой знаний"
                  text="Отвечает на вопросы по вашим документам, цитирует источники, помнит контекст"
                />
                <FeatureCard
                  title="База знаний"
                  text="Загружайте PDF, DOCX, XLSX, CSV, ссылки на сайт. AI индексирует в pgvector"
                />
                <FeatureCard
                  title="Клиенты (CRM)"
                  text="Карточки с реквизитами, теги, история. AI ищет, обновляет, делает заметки"
                />
                <FeatureCard
                  title="Документы"
                  text="Шаблон + клиент → готовый .docx. AI разбирает любой загруженный шаблон"
                />
                <FeatureCard
                  title="Командный чат"
                  text="Личные, групповые, общие AI-каналы. Realtime, @-упоминания"
                />
                <FeatureCard
                  title="Action Engine"
                  text="AI выполняет действия с подтверждением: генерация документов, поиск клиентов, draft писем"
                />
              </ul>
            </section>

            <section id="how" className="mt-14 scroll-mt-24">
              <h2>Как это работает</h2>
              <p>
                Архитектура простая. Вопрос пользователя проходит маршрутизацию через быструю модель (DeepSeek), которая
                определяет тип запроса. Если это вопрос — Offi ищет релевантные фрагменты в вашей базе знаний по векторному
                поиску и передаёт их в Claude Sonnet вместе с вопросом. Получаете ответ с цитатами.
              </p>
              <p>
                Если это действие («составь договор для X», «найди клиента Y», «напиши черновик письма») —
                Claude вызывает соответствующий инструмент, выполняет работу, возвращает результат. Перед опасными
                действиями вы подтверждаете в интерфейсе.
              </p>
              <p>
                Стек: Next.js 14, Supabase (Postgres + pgvector + Auth + Realtime), RouterAI.ru как
                OpenAI-совместимый прокси (DeepSeek V3.2 для маршрутизации, Claude Sonnet 4.6 как основная модель,
                text-embedding-3-small для векторов), Postmark для email.
              </p>
            </section>

            <section id="start" className="mt-14 scroll-mt-24">
              <h2>Как начать</h2>
              <ol>
                <li>Зарегистрируйтесь на <a href="https://offi-ai.com">offi-ai.com</a> — нужны email и пароль.</li>
                <li>Подтвердите email и создайте компанию (название и имя ассистента — по умолчанию «Оффи»).</li>
                <li>Загрузите 3-5 ключевых документов в раздел «База знаний»: прайс, описание услуг, FAQ, регламент.</li>
                <li>Откройте AI-чат и задайте первый вопрос по этим документам.</li>
                <li>Пригласите коллег через раздел «Команда» — у каждого свой логин, общий доступ к компании.</li>
              </ol>
              <p>
                Время до первого ответа — обычно 5-10 минут с момента регистрации. На пилоте мы помогаем подключиться
                лично в Zoom за 30-60 минут.
              </p>
            </section>

            <section id="documents" className="mt-14 scroll-mt-24">
              <h2>Документы и шаблоны</h2>
              <p>
                Offi умеет генерировать .docx по шаблонам с автозаполнением полей клиента. Загрузите ваш шаблон договора —
                AI проанализирует, найдёт в нём поля для замены (ФИО, реквизиты, суммы, даты), предложит структуру.
                Вы дотюниваете поля и сохраняете шаблон.
              </p>
              <p>
                Дальше из чата: «составь договор для клиента Иванов на 50 000 рублей» — AI находит клиента в базе,
                подставляет реквизиты, скачивает готовый .docx за 30 секунд.
              </p>
              <p>
                Также можно создавать текстовые шаблоны (markdown) для писем и сообщений с переменными вида{" "}
                <code>&#123;&#123;client.greeting&#125;&#125;</code> — AI подставит подходящее обращение к клиенту.
              </p>
            </section>

            <section id="team" className="mt-14 scroll-mt-24">
              <h2>Команда и роли</h2>
              <p>
                Каждый пользователь привязан к одной компании. Внутри компании могут быть:
              </p>
              <ul>
                <li><strong>Владелец</strong> — полный доступ, биллинг, удаление компании</li>
                <li><strong>Администратор</strong> — управление командой, настройки, шаблоны</li>
                <li><strong>Сотрудник</strong> — использование чата, доступ к базе знаний и клиентам</li>
              </ul>
              <p>
                В командном чате есть личные диалоги, групповые комнаты, общие AI-каналы (где AI отвечает всем сразу),
                каналы по проектам. @-упоминания подсвечивают коллегу. Realtime — сообщения приходят мгновенно.
              </p>
            </section>

            <section id="security" className="mt-14 scroll-mt-24">
              <h2>Безопасность и данные</h2>
              <p>
                Данные шифруются при передаче (TLS 1.2+) и в хранилище. На уровне базы данных — Row-Level Security:
                ваши клиенты, документы и сообщения изолированы от других компаний на уровне SQL-политик.
                Никакой пользователь Offi из другой компании не может увидеть ваши данные технически.
              </p>
              <p>
                AI-провайдеры (Claude, DeepSeek через RouterAI) <strong>не используют</strong> ваши данные для обучения моделей.
                Это закрепляется в наших соглашениях с поставщиками.
              </p>
              <p>
                Текущее место хранения — Supabase (ЕС, Франкфурт). Миграция первичных хранилищ ПДн на территорию РФ
                запланирована до сентября 2026 (Selectel или Yandex Cloud) для полного соответствия 152-ФЗ.
              </p>
              <p>
                Полные условия — в{" "}
                <Link href="/legal/privacy">Политике обработки персональных данных</Link>,{" "}
                <Link href="/legal/dpa">DPA</Link> и{" "}
                <Link href="/legal/offer">Оферте</Link>.
              </p>
            </section>

            <section id="integrations" className="mt-14 scroll-mt-24">
              <h2>Интеграции</h2>
              <p>На текущий момент работают:</p>
              <ul>
                <li><strong>Email</strong> — отправка через Postmark (на пилоте — в режиме draft, отправка вручную)</li>
                <li><strong>Telegram</strong> — уведомления и напоминания (в разработке)</li>
                <li><strong>ЮKassa</strong> — приём платежей за тариф</li>
              </ul>
              <p>В разработке:</p>
              <ul>
                <li>AmoCRM — синхронизация клиентов и сделок</li>
                <li>Bitrix24 — то же самое</li>
                <li>1С (через OData) — выгрузка контрагентов и счетов</li>
                <li>Google Calendar / Yandex.Календарь — встречи</li>
              </ul>
            </section>

            <section id="faq" className="mt-14 scroll-mt-24">
              <h2>Частые вопросы</h2>

              <FaqItem q="Можно ли использовать Offi бесплатно?">
                Да. Тариф «Пробный» — 14 дней бесплатно, 1 пользователь, 30 AI-запросов. Этого хватит для оценки.
                Для полной проверки командой — берите пилот на месяц бесплатно (тариф «Старт», 3 человека, 800 запросов).
                Пишите на hello@offi-ai.com — пришлём промокод и поможем подключиться лично.
              </FaqItem>

              <FaqItem q="Что такое Founders Pricing?">
                Первые 50 платящих клиентов получают зафиксированную скидку 50% на стандартный прайс пожизненно
                при условии непрерывной подписки. Например, тариф «Бизнес» вместо 9 990 ₽ обойдётся в{" "}
                <strong>4 990 ₽/мес</strong> — и эта цена не меняется никогда.
                Активируется промокодом <code>FOUNDER</code> в разделе настроек тарифа.
              </FaqItem>

              <FaqItem q="Что если AI ответит неправильно?">
                AI отвечает на основе ваших документов с цитатой источника. Если данных нет — не выдумывает,
                а говорит «по моим данным нет». Действия (договоры, письма) выполняются в режиме черновика —
                пользователь подтверждает перед использованием. Ответственность за решения на основе ответов AI
                лежит на пользователе (см. Оферта, п. 9.2).
              </FaqItem>

              <FaqItem q="Где физически хранятся наши данные?">
                Сейчас — в дата-центрах Supabase в ЕС (Франкфурт). Миграция первичных хранилищ на территорию РФ
                (Selectel / Yandex Cloud) запланирована до сентября 2026. Подробнее в{" "}
                <Link href="/legal/privacy">Политике обработки ПДн</Link>.
              </FaqItem>

              <FaqItem q="Можно ли выгрузить свои данные?">
                Да, в любой момент. Все документы, клиенты, шаблоны и история чатов выгружаются в стандартных форматах
                (CSV, JSON, оригинальные .docx). Запрос — через интерфейс или на privacy@offi-ai.com.
              </FaqItem>

              <FaqItem q="Что произойдёт, если сервис закроется?">
                Все ваши данные в любой момент выгружаемы в стандартных форматах. Если сервис прекратит работу,
                мы уведомим вас за 90 дней и предоставим инструкции по выгрузке.
              </FaqItem>

              <FaqItem q="Можно ли заплатить от юридического лица?">
                Да. Выставляем счёт по реквизитам компании. Закрывающие документы (акт, чек) направляем после оплаты.
                На текущий момент работаем как самозанятый (НПД), без НДС. Переход на ИП с УСН — в Q3 2026.
              </FaqItem>

              <FaqItem q="Как связаться с командой?">
                <ul className="list-none p-0">
                  <li>Общие вопросы и пилоты: <a href="mailto:hello@offi-ai.com">hello@offi-ai.com</a></li>
                  <li>Запросы по персональным данным: <a href="mailto:privacy@offi-ai.com">privacy@offi-ai.com</a></li>
                  <li>Поддержка платных клиентов: <a href="mailto:support@offi-ai.com">support@offi-ai.com</a></li>
                </ul>
              </FaqItem>
            </section>

            <footer className="mt-20 border-t border-[hsl(var(--border-light))] pt-6 text-xs text-muted-foreground print:mt-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>© {new Date().getFullYear()} Offi · offi-ai.com</span>
                <div className="flex gap-3">
                  <Link href="/legal" className="text-primary hover:underline">
                    Юридические документы
                  </Link>
                  <Link href="/" className="text-primary hover:underline">
                    На главную
                  </Link>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-2xl border border-[hsl(var(--border))] bg-white p-5">
      <h3 className="text-[14.5px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">{text}</p>
    </li>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-xl border border-[hsl(var(--border))] bg-white open:border-primary/30 open:shadow-[0_4px_20px_-12px_rgba(2,89,221,0.18)]">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-[14.5px] font-semibold text-foreground outline-none transition-colors group-open:text-primary">
        {q}
      </summary>
      <div className="px-4 pb-4 pt-0 text-[13.5px] leading-[1.6] text-muted-foreground">{children}</div>
    </details>
  );
}
