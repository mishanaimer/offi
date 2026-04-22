/**
 * Извлечение фактов из пользовательских сообщений и их запись в memories.
 * Выполняется неблокирующе (без await в горячем пути).
 */

import { chatCompletion, MODELS } from "./ai";
import { embedBatch } from "./embeddings";
import { createServiceClient } from "./supabase/server";

export type ExtractedFact = {
  content: string;
  kind: "fact" | "preference" | "agreement" | "rule";
};

const EXTRACT_SYSTEM = `Ты — экстрактор фактов для корпоративной памяти AI-ассистента.
Из сообщения пользователя выдели 0-3 конкретных, долгоживущих факта о:
- компании / её процессах
- клиентах, сделках, договорённостях
- сотрудниках и ролях
- продуктах, ценах, правилах

Игнорируй: вопросы, приветствия, мимолётные реплики, "ok", "спасибо".
Только ЯВНЫЕ факты. Если ничего не выделяется — верни пустой массив.

Верни строго JSON вида:
{"facts":[{"content":"...","kind":"fact|preference|agreement|rule"}]}`;

export async function extractFacts(userMessage: string): Promise<ExtractedFact[]> {
  if (!userMessage || userMessage.trim().length < 12) return [];
  try {
    const res = await chatCompletion(
      [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: userMessage },
      ],
      { model: MODELS.router, temperature: 0, max_tokens: 250 }
    );
    const raw = res.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const facts: ExtractedFact[] = Array.isArray(parsed.facts) ? parsed.facts : [];
    return facts
      .filter((f) => typeof f?.content === "string" && f.content.trim().length > 0)
      .map((f) => ({
        content: f.content.trim().slice(0, 500),
        kind: (["fact", "preference", "agreement", "rule"].includes(f.kind) ? f.kind : "fact") as ExtractedFact["kind"],
      }))
      .slice(0, 3);
  } catch (e) {
    console.error("extractFacts failed:", (e as Error).message);
    return [];
  }
}

/**
 * Сохраняем извлечённые факты пачкой (embeddings одним батчем).
 * Вызывается через setImmediate/void-promise, не блокирует стрим.
 */
export async function persistFacts(
  facts: ExtractedFact[],
  opts: { companyId: string; userId: string | null; sourceId?: string | null }
): Promise<void> {
  if (!facts.length) return;
  try {
    const vectors = await embedBatch(facts.map((f) => f.content));
    const service = createServiceClient();
    const rows = facts.map((f, i) => ({
      company_id: opts.companyId,
      content: f.content,
      kind: f.kind,
      source: "chat",
      source_id: opts.sourceId ?? null,
      created_by: opts.userId,
      embedding: vectors[i] as any,
    }));
    const { error } = await service.from("memories").insert(rows);
    if (error) console.error("memory insert failed:", error.message);
  } catch (e) {
    console.error("persistFacts failed:", (e as Error).message);
  }
}

export function scheduleFactExtraction(
  userMessage: string,
  opts: { companyId: string; userId: string | null; sourceId?: string | null }
) {
  // fire-and-forget — не ждём, ошибки только логируем
  void extractFacts(userMessage).then((facts) => persistFacts(facts, opts));
}
