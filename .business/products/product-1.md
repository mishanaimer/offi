# Offi MVP

Что входит в первый релиз.

## Ядро
- **Онбординг** — 4 шага: компания → имя ассистента → база знаний → готово
- **AI-чат с RAG** — streaming, источники, история, быстрые подсказки
- **База знаний** — PDF / DOCX / XLSX / CSV / URL / свой текст
- **Клиенты** — карточки, поиск, импорт CSV
- **Документы** — шаблоны, переменные `{{client.name}}`, превью, копирование
- **Командный чат** — Realtime, закрепление, групповые и AI-каналы
- **Настройки** — имя ассистента, акцент бренда, интеграции (переключатели)

## Action Engine
- send_email (Postmark)
- send_telegram (Bot API)
- create_meeting (заглушка → Телемост)
- add_to_calendar (заглушка → Google/Яндекс)
- find_client, generate_document

## Лендинг
/ — Hero с анимированным демо-чатом, фичи, тарифы, FAQ, CTA.

## Технически
Next.js 14 + Supabase + pgvector + RouterAI (DeepSeek роутер + Claude Sonnet 4.6 основной).
