# Project Map (для AI-агентов — читай это вместо сканирования)

> Одностраничный «граф» проекта. Помогает новому агенту за 1 файл понять, что где лежит и какую цепочку трогать.

## Цепочки (какие файлы трогать под задачу)

### 1. RAG-пайплайн (вопрос → ответ с источниками)
```
chat-view.tsx          → POST /api/chat
src/app/api/chat/route.ts
  → lib/ai.ts (classify) → DeepSeek (type: question/action/smalltalk)
  → lib/embeddings.ts (embed) → RouterAI embeddings
  → supabase.rpc("match_chunks") → top-5 чанков
  → lib/ai.ts (chatCompletionStream) → Claude Sonnet → SSE
  ← клиент парсит SSE { type: "sources" | "delta" }
```
Схема: `chunks.embedding vector(1536)` + ivfflat index + rpc `match_chunks(vec, company_id, k)`.

### 2. Ingestion (файл/URL/текст → чанки → pgvector)
```
knowledge-view.tsx  — drag-n-drop, URL-вставка, текст
  → /api/upload      — файлы (PDF через pdf-parse, DOCX через mammoth)
  → /api/ingest      — URL / текст
оба вызывают: chunkText() + embedBatch() → insert chunks
```

### 3. Auth + Onboarding
```
/register → /onboarding (wizard) → создаёт companies + users.company_id + канал → /chat
middleware.ts → редиректит /login|/register если залогинен; редиректит защищённые → /login
(app)/layout.tsx → если нет company_id → /onboarding
```

### 4. Action Engine
```
ассистент возвращает tool_call → UI показывает подтверждение (TODO) → POST /api/actions
/api/actions → adapters/email, telegram, calendar → пишет в action_log
```

### 5. Командный чат (Realtime)
```
team-view.tsx → supabase.channel(`messages:${id}`).on("postgres_changes", INSERT, ...) 
канал типа "ai" создаётся при онбординге
```

## Куда НЕ лазить
- `supabase/migrations/0001_init.sql` — трогай только через новую миграцию `0002_*.sql`
- `src/lib/supabase/*` — если ломать, ломается всё
- `next-env.d.ts` — авто-генерится

## Env (полный список)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ROUTERAI_API_KEY`, `ROUTERAI_BASE_URL` (опц.), `ROUTERAI_ROUTER_MODEL` (опц.), `ROUTERAI_MAIN_MODEL` (опц.), `ROUTERAI_EMBEDDING_MODEL` (опц.),
`POSTMARK_API_KEY` (опц.), `POSTMARK_FROM_EMAIL` (опц.), `TELEGRAM_BOT_TOKEN` (опц.), `NEXT_PUBLIC_APP_URL`.

## Дизайн-токены
Источник правды: `src/app/globals.css` (CSS) + `src/lib/design-tokens.ts` (TS). Акцент: `#1a6eff` (HSL 219 100% 55%). Шрифт: Geist. Радиус: 14px. Apple-минимализм, светлые тона.

## Модели LLM (RouterAI)
| Назначение | Модель | Цена (₽/1M in) |
|---|---|---|
| Router | deepseek-v3.2 | 25 |
| Main | claude-sonnet-4-6 | 296 |
| Embedding | text-embedding-3-small | 20 |

## Tabs приложения (порядок важен — так же в mobile tab bar)
chat → knowledge → clients → documents → team → settings

## RLS policies
Все таблицы с `company_id` — одна generic политика: `company_id = current_company_id()`. Users видят себя и коллег по компании.

## Что заглушка, что настоящее
| Feature | Статус |
|---|---|
| Auth + Onboarding | ✅ реально |
| Чат + RAG + streaming | ✅ реально |
| Upload файлов + ingest URL/текст | ✅ реально |
| Клиенты, документы, шаблоны | ✅ реально |
| Командный чат (Realtime) | ✅ реально |
| Настройки + кастомизация | ✅ реально |
| Email (Postmark) | ✅ реально (если ключ) |
| Telegram (Bot API) | ✅ реально (если токен) |
| Google/Яндекс Календарь | 🟡 заглушка (возвращает mock-ссылку) |
| AmoCRM / Bitrix24 / 1С | 🟡 заглушка |
| UI подтверждения действий в чате | 🟡 TODO (backend готов) |
| Приглашение сотрудников | ❌ не реализовано |
| Биллинг ЮKassa | ❌ не реализовано |
