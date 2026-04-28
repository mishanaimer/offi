# CLAUDE.md — Offi (offi.ai)

## Что это
AI-агент для компаний. Загрузил документы, сайт, клиентов → общаешься как с ChatGPT, но он знает твой бизнес и умеет действовать: отправлять письма, назначать встречи, генерировать договоры, писать в Telegram.

## Название и персонаж
Платформа: **Offi**. Дефолтный ассистент: **Оффи**. Компания может переименовать: ДентОпт→Денти, АйСистемс→Айли. Алгоритм: первые 2-4 буквы + мягкое окончание (-и, -ли, -ко).

## Стек
- **Frontend:** Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **LLM API:** RouterAI.ru (оплата рублями, без VPN, tool use поддерживается)
- **Модели:** DeepSeek V3.2 (router, 25₽/1M) + Claude Sonnet 4.6 (сложные, 296₽/1M)
- **БД/Auth/Storage/Realtime:** Supabase (PostgreSQL + pgvector + Auth + Storage)
- **Email:** Postmark API
- **Деплой:** Vercel (frontend) + Vercel API Routes (backend)

## Архитектура (как работает каждый запрос)
```
Пользователь → "Сколько стоит сайт?"
  → POST /api/chat
  → Router (DeepSeek, ~0.01₽): классифицирует → type: "question"
  → Embedding вопроса → поиск по pgvector → топ-5 чанков из документов
  → Claude Sonnet: системный промпт + чанки + вопрос → ответ
  → Пользователь видит ответ с указанием источника
```
```
Пользователь → "Отправь Иванову договор и назначь встречу"
  → Router: type: "action"
  → Claude Sonnet с tool_use: получает список функций (send_email, create_meeting...)
  → Claude решает: 1) find_client → 2) generate_doc → 3) send_email → 4) add_to_calendar
  → Каждый шаг: Claude говорит ЧТО вызвать → Backend вызывает реальный API → результат назад
  → Перед отправкой клиенту → UI подтверждения "Выполнить?"
```

## База знаний (как AI учится)
Загрузка файлов (PDF/DOCX/XLSX/CSV) или URL сайта → парсинг → чанки (800 токенов, overlap 150) → embeddings → pgvector. При вопросе: embedding вопроса → cosine similarity → топ-5 чанков → контекст для Claude. Можно составить базу знаний с AI: "Вот информация о нашей компании, структурируй в базу знаний".

## Функции MVP
1. **Онбординг:** регистрация → название компании → имя ассистента → загрузка файлов/URL → первый вопрос
2. **AI-чат:** вопросы по базе знаний, RAG с источниками, история чатов
3. **База знаний:** загрузка файлов (drag-and-drop), вставка URL сайта, ручное добавление текста, составление с AI
4. **Клиенты:** карточки (название, контакт, телефон, email, реквизиты), импорт CSV
5. **Документы:** библиотека шаблонов, генерация договоров (шаблон+клиент→.docx/PDF), превью, скачивание
6. **Командный чат:** личные сообщения, групповые чаты, общие AI-чаты (коллеги+ассистент), каналы по проектам
7. **Действия (Action Engine):** отправка email от имени сотрудника, сообщения в Telegram, создание встреч (Телемост/Zoom), календари сотрудников
8. **Интеграции:** Email (IMAP/SMTP), Telegram Bot, AmoCRM, Bitrix24, 1С (OData), Google Drive
9. **Лендинг:** offi.ai — hero + демо-чат + фичи + тарифы + FAQ + CTA

## Экономика
```
Модель 70/20/10: 70% запросов DeepSeek (0.15₽) / 20% Sonnet (0.80₽) / 10% actions (3.20₽)
Средний запрос с оптимизацией: 0.56₽
Тариф "Бизнес" (5990₽/мес, 10 сотрудников, 3000 запросов): себестоимость ~990₽ → маржа 83%
```
| | Пробный | Старт | Бизнес | Команда |
|---|---|---|---|---|
| Цена | 0₽/14д | 2490₽/мес | 5990₽/мес | 11990₽/мес |
| AI-запросов | 50 | 500 | 3000 | 15000 |
| Сотрудников | 1 | 3 | 10 | 30 |
| Документов | 10 | 50 | 300 | ∞ |
| Действия | 5 | 50 | 500 | 3000 |
| Интеграции | — | Email,TG | +CRM | +1С,API |

Допродажа: 1000 запросов сверх лимита = 990₽. При 30 запросах/чел/день маржа всё ещё 55-66%.

## Vault integration (общая память для Telegram-бота)

Юзер ведёт общий «второй мозг» — Obsidian vault по пути:
`C:\Users\m.vasilchuk\SecondBrain`

Vault синкается с приватным GitHub-репо, оттуда его читает Telegram-бот (`@poe_asist_bot`) на VPS. Всё, что попадает в этот vault, бот видит через RAG и использует для ответов.

**Для этого проекта файл-карточка:** `C:\Users\m.vasilchuk\SecondBrain\02 Projects\offi.md`

### Когда обновлять карточку
После каждого значимого изменения в проекте: новая фича, важный рефакторинг, починенный баг с интересной причиной, принятое архитектурное решение, обнаруженная проблема, открытый вопрос.

Мелкие правки (опечатки, переименование переменной) — не трогать.

### Структура файла
```markdown
---
tags: [project, offi]
repo: mishanaimer/offi
updated: YYYY-MM-DD
---
# Offi

> Краткое описание (1-2 строки)

## Стек и где живёт
- ...

## Текущий статус
- Что в работе сейчас
- На каком этапе спринта

## Текущие задачи
- [ ] Задача 1
- [ ] Задача 2

## История изменений
- `2026-04-25` — что сделал и почему (1-3 строки)
- `2026-04-23` — ...

## Открытые вопросы
- Что не решено, что мешает
```

### Как обновлять
1. Прочитать существующий файл-карточку (если есть). Не перезаписывать целиком — дополнять.
2. В `## История изменений` дописывать **сверху** новой строкой с сегодняшней датой.
3. `## Текущие задачи` и `## Текущий статус` — актуализировать.
4. Поле `updated:` во frontmatter — обновить.
5. Закоммитить и запушить vault:
   ```bash
   git -C "C:/Users/m.vasilchuk/SecondBrain" add "02 Projects/offi.md"
   git -C "C:/Users/m.vasilchuk/SecondBrain" commit -m "offi: <что обновил>"
   git -C "C:/Users/m.vasilchuk/SecondBrain" push
   ```

Это критично — без push сервер бота не получит обновление.

## Оптимизации (включить сразу)
- **Prompt caching:** системный промпт кэшируется, экономия 45% на input
- **Smart router:** DeepSeek для простых вопросов, Sonnet только для сложных
- **Кэш ответов:** повторные вопросы за день → из кэша (0₽)
- **Batch API:** генерация документов со скидкой 50%

## Конкуренты
Chatbase ($40-500) — только виджет. CustomGPT ($99-499) — нет действий. MS Copilot ($30/чел) — дорого. Claude Projects ($20/чел) — нет CRM. **Наша ниша:** всё в одном, $27-130 за компанию, заточено под РФ.

## Структура проекта
```
offi/
├── app/(auth)/login/              — вход/регистрация
├── app/(dashboard)/chat/          — AI-чат (главный экран)
├── app/(dashboard)/knowledge/     — база знаний
├── app/(dashboard)/clients/       — карточки клиентов
├── app/(dashboard)/documents/     — генерация документов
├── app/(dashboard)/team/          — командный чат (Supabase Realtime)
├── app/(dashboard)/settings/      — настройки, интеграции
├── app/(landing)/                 — лендинг offi.ai
├── app/api/chat/route.ts          — RAG pipeline
├── app/api/upload/route.ts        — загрузка файлов + парсинг + embeddings
├── app/api/classify/route.ts      — Router AI (DeepSeek)
├── app/api/actions/route.ts       — Action Engine (tool use)
├── lib/ai.ts                      — RouterAI client
├── lib/supabase.ts                — Supabase client
├── lib/embeddings.ts              — embeddings + vector search
├── lib/tools.ts                   — определения tools для Claude
├── adapters/email.ts              — Postmark SMTP
├── adapters/telegram.ts           — Telegram Bot API
├── adapters/calendar.ts           — Google/Yandex Calendar
├── adapters/amocrm.ts             — AmoCRM REST
├── .business/                     — бизнес-документация
└── .env.local                     — ROUTERAI_API_KEY, SUPABASE_URL...
```

## Supabase схема
```sql
-- Компании и пользователи
create table companies (id uuid primary key, name text, assistant_name text, plan text);
create table users (id uuid primary key, company_id uuid references companies, email text, role text);
-- База знаний
create table documents (id uuid primary key, company_id uuid, name text, file_url text, chunks_count int);
create table chunks (id uuid primary key, document_id uuid, company_id uuid, content text, embedding vector(1536));
-- Клиенты
create table clients (id uuid primary key, company_id uuid, name text, contact text, phone text, email text, data jsonb);
-- Чаты и сообщения
create table channels (id uuid primary key, company_id uuid, name text, type text); -- dm/group/ai/shared_ai/project
create table channel_members (channel_id uuid, user_id uuid, role text);
create table messages (id uuid primary key, channel_id uuid, user_id uuid, content text, is_ai bool, pinned bool, created_at timestamptz);
-- Документы и шаблоны
create table templates (id uuid primary key, company_id uuid, name text, file_url text, variables jsonb);
create table generated_docs (id uuid primary key, company_id uuid, client_id uuid, template_id uuid, file_url text);
-- Интеграции и действия
create table integrations (id uuid primary key, company_id uuid, type text, config jsonb, enabled bool);
create table action_log (id uuid primary key, company_id uuid, user_id uuid, action text, params jsonb, status text, result jsonb, created_at timestamptz);
```

## Спринты
1. **(2нед)** Auth + загрузка файлов + RAG-чат + база знаний (URL+файлы+текст)
2. **(2нед)** Router + клиенты + командный чат (Realtime) + кастомизация ассистента
3. **(2нед)** Документы + Action Engine + Email + Telegram + календари
4. **(2нед)** AmoCRM + Bitrix24 + лендинг + тарифы + ЮKassa + онбординг

MVP (чат+документы+команда) = 4 недели. Полный продукт = 8 недель.

## Запуск пилота (АйСистемс, ассистент "Айли")
RouterAI.ru: 3000₽. Supabase: free. Vercel: free. Postmark: free (100/мес). Telegram: free. **Итого: ~1500₽/мес.**

---

---

## 📊 Sync с Obsidian vault

При **значимых изменениях** в этом проекте (зафиксил баг / закрыл фазу /
сделал крупную фичу — а не каждый коммит) делай следующее:

1. **Открой** `<vault>/02 Projects/offi/_index.md` (vault путь юзера —
   локальный, узнавай через `$VAULT_PATH` или спрашивай).

2. **Допиши строку** в секции «## Лог активности» между маркерами
   `<!-- bot:log:start -->` и `<!-- bot:log:end -->` в формате:

   ```
   - [YYYY-MM-DD HH:MM] (claude) короткая фраза о том что сделано
   ```

   Время — текущее локальное (Europe/Moscow). Текст — 1 фраза, как в
   commit message, но человеческим языком, не техническим.

3. **Если закрыл фазу** — отметь `[x]` в секции «## Фазы» и пересчитай
   `phases_done` в YAML frontmatter (вверху файла, между `---`).

4. **Обнови** `last_activity: YYYY-MM-DD` в frontmatter.

5. **Закоммить vault**:

   ```bash
   cd <vault>
   git add -A
   git commit -m "[offi] <та же короткая фраза>"
   git push
   ```

   Это даст синку на сервер бота через `git_sync.py` (`GIT_SYNC=on`),
   и бот в вечернем ревью покажет тебе строку «offi ▓▓▓░░ 3/8 — claude
   починил X».

## Что НЕ нужно делать

- Не дублируй строки лога. Если ты уже добавил запись о этой фиче 5 минут
  назад — допиши к ней, а не делай новую.
- Не трогай `_index.md` других проектов.
- Не меняй `tags`/`area` в frontmatter — это юзер сам настроил.
- Если `_index.md` нет — не создавай его сам, попроси юзера сделать
  через бота: «скажи ассистенту: `создай проект <name> в области <area>`».
