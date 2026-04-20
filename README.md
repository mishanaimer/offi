# Offi — AI-агент для бизнеса

Загрузи документы, сайт, клиентов → общайся как с ChatGPT, но он знает твой бизнес и умеет действовать.

**Стек:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + pgvector + Auth + Realtime + Storage) · RouterAI.ru (DeepSeek V3.2 роутер + Claude Sonnet 4.6 основной).

---

## 🚀 Быстрый старт (локально)

```bash
git clone https://github.com/mishanaimer/offi.git
cd offi
cp .env.example .env.local   # заполни ключи (см. ниже)
npm install
npm run dev
```

Откроется на http://localhost:3000

---

## 🧩 Настройка Supabase

1. **Создай проект** на [supabase.com](https://supabase.com) (регион Frankfurt — ближайший быстрый).
2. Во вкладке **SQL Editor** → открой `supabase/migrations/0001_init.sql` и выполни целиком. Это создаст все таблицы, pgvector, RLS-политики и триггер автосоздания профиля.
3. Во вкладке **Authentication → Providers → Email** — включи, для MVP можно выключить «Confirm email» (чтобы не возиться с SMTP на этапе теста).
4. Во вкладке **Storage** создай три бакета:
   - `documents` — private
   - `templates` — private
   - `avatars` — public
5. Скопируй в `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (Settings → API → Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon/public)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role — держи в секрете!)

---

## 🤖 Настройка RouterAI

1. Зарегистрируйся на [routerai.ru](https://routerai.ru), пополни баланс (3000 ₽ хватит на месяц пилота).
2. Создай API-ключ → скопируй в `.env.local` как `ROUTERAI_API_KEY`.
3. Модели по умолчанию:
   - Router: `deepseek-v3.2` (классификация, 0.01 ₽/запрос)
   - Main: `claude-sonnet-4-6` (основной ответ, ~0.8 ₽/запрос)
   - Embeddings: `text-embedding-3-small`
4. Если имена моделей отличаются — переопредели через `ROUTERAI_ROUTER_MODEL`, `ROUTERAI_MAIN_MODEL`, `ROUTERAI_EMBEDDING_MODEL`.

---

## ✉️ Опционально (Email + Telegram)

- **Postmark** — зарегистрируйся, подтверди домен offi.ai, создай server token → `POSTMARK_API_KEY`.
- **Telegram** — `@BotFather` → `/newbot` → токен → `TELEGRAM_BOT_TOKEN`.

Без этих ключей действия `send_email` и `send_telegram` вернут `ok: false` — остальное будет работать.

---

## ☁️ Деплой на Vercel

1. Зайди на [vercel.com](https://vercel.com) → **Add New Project** → импортируй `mishanaimer/offi`.
2. Framework: Next.js (подхватится автоматически).
3. Environment Variables — добавь ВСЕ переменные из `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ROUTERAI_API_KEY
ROUTERAI_BASE_URL=https://routerai.ru/api/v1
POSTMARK_API_KEY            # опционально
POSTMARK_FROM_EMAIL         # опционально (hello@offi.ai)
TELEGRAM_BOT_TOKEN          # опционально
NEXT_PUBLIC_APP_URL         # https://твой-домен.vercel.app или https://offi.ai
```

4. Deploy.
5. После деплоя в Supabase → **Authentication → URL Configuration**:
   - Site URL: твой прод-домен
   - Redirect URLs: добавь `https://твой-домен/api/auth/callback`

---

## 🧪 Как протестить

1. Открой прод-домен → увидишь лендинг
2. «Попробовать» → регистрация
3. Онбординг: название компании → имя ассистента → вставь URL сайта или текст → «Начать»
4. В чате задай вопрос, связанный с загруженным контентом → ассистент ответит с источниками
5. Загрузи PDF в «База знаний», задай вопрос по нему
6. В «Клиенты» добавь карточку, в «Документы» создай шаблон с `{{client.name}}`, собери превью

---

## 📱 Мобильная адаптация

- `viewport-fit=cover` + `initialScale=1` + `maximumScale=1`
- Все высоты через `100dvh`
- `safe-area-inset-bottom` для нижнего tab bar
- `-webkit-tap-highlight-color: transparent`
- `touch-action: manipulation`
- `font-size: 16px` на input (предотвращает iOS zoom)
- Скругление контейнера 16px — выглядит нативно в Telegram WebView
- Никаких hover-эффектов на touch-устройствах (`@media (hover: hover)`)

**Рекомендуется протестировать:** Safari iOS, Chrome Android, Telegram WebView, Chrome desktop.

---

## 🏗️ Структура

```
src/
  app/
    (auth)/login, register/      — страницы входа/регистрации
    (app)/chat, knowledge,       — защищённое приложение
           clients, documents,
           team, settings/
    onboarding/                  — мастер первого запуска
    api/
      chat/                      — RAG + streaming
      upload/                    — приём файлов → парсинг → embeddings
      ingest/                    — URL / текст → чанки → pgvector
      classify/                  — роутер запросов (DeepSeek)
      actions/                   — Action Engine (tool use)
    page.tsx                     — лендинг
    globals.css                  — дизайн-токены (CSS-переменные)
  components/
    ui/ — button, input, card, label
    landing/ — hero, demo-chat, features, pricing, faq, cta
    app-shell.tsx                — sidebar + mobile tab bar
  lib/
    supabase/                    — клиенты (browser, server, middleware, admin)
    ai.ts                        — RouterAI wrapper
    embeddings.ts                — embed + chunkText
    tools.ts                     — определения функций для Claude
    assistant-name.ts            — автогенерация имени ассистента
    design-tokens.ts             — TS-токены дизайн-системы
    utils.ts                     — cn, formatDate, formatRub, truncate
  adapters/
    email.ts telegram.ts calendar.ts amocrm.ts

supabase/
  migrations/0001_init.sql       — вся схема + RLS

.business/
  INDEX.md                       — оглавление бизнес-документации
  company, products, audience,
  goals, economics, marketing,
  assets, история
```

---

## 🎨 Дизайн-система

Apple-минимализм. Светлая тема по умолчанию, единственный акцент `#1a6eff`. Geist Sans + Geist Mono.

Токены в `src/app/globals.css` (CSS-переменные) и `src/lib/design-tokens.ts` (TS). Когда появится финальная система от Claude Design — обнови оба файла.

---

## ❓ Чего нет в MVP

- Приглашение сотрудников по ссылке (временно — одна компания = один owner)
- Биллинг через ЮKassa (пилот оплачивается вручную)
- Интеграции AmoCRM / Bitrix24 / 1С (адаптеры-заглушки готовы, реальная логика — следующий спринт)
- Голосовой ввод
- Email-верификация (по умолчанию выключается в Supabase на период тестирования)

---

## 📞 Контакты

- Основатель: Михаил — `gign230102@gmail.com`
- Telegram: @mishanaimer
- Почта продукта: hello@offi.ai
