import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { chatCompletion, MODELS, type ChatMessage } from "@/lib/ai";
import { embed } from "@/lib/embeddings";
import { truncate } from "@/lib/utils";
import { currentPeriod, getPlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { channel_id } — запускает ассистента в канале.
 * Читает последние ~16 сообщений как контекст, делает RAG (chunks+memories),
 * получает ответ ассистента и вставляет его в messages (с is_ai=true).
 * Фронт получит его через Realtime-подписку.
 */
export async function POST(req: NextRequest) {
  const { channel_id } = await req.json().catch(() => ({}));
  if (!channel_id) return Response.json({ error: "channel_id required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  // проверяем, что канал — AI-канал, и пользователь в нём состоит
  const { data: channel } = await supabase
    .from("channels")
    .select("id, type, company:companies(id, name, assistant_name, plan)")
    .eq("id", channel_id)
    .single();
  if (!channel) return new Response("channel not found", { status: 404 });
  if (!["ai", "shared_ai"].includes((channel as any).type)) {
    return Response.json({ error: "not an AI channel" }, { status: 400 });
  }

  const company = (channel as any).company;
  const service = createServiceClient();

  // лимит запросов
  const period = currentPeriod();
  const plan = getPlan(company.plan);
  const { data: usage } = await service
    .from("usage_counters")
    .select("requests_count")
    .eq("company_id", company.id)
    .eq("period", period)
    .maybeSingle();
  const used = usage?.requests_count ?? 0;
  if (used >= plan.limits.requests) {
    await service.from("messages").insert({
      channel_id,
      user_id: null,
      content: `⚠️ Лимит запросов исчерпан по тарифу «${plan.name}». Перейдите в Настройки → Тарифы.`,
      is_ai: true,
    });
    return Response.json({ ok: true, limited: true });
  }

  // история канала
  const { data: history } = await service
    .from("messages")
    .select("content, is_ai, user_id")
    .eq("channel_id", channel_id)
    .order("created_at", { ascending: false })
    .limit(16);
  const ordered = (history ?? []).reverse();

  const lastUser = [...ordered].reverse().find((m) => !m.is_ai);
  const question = lastUser?.content ?? "";

  // RAG (как в /api/chat)
  let context = "";
  let sources: Array<{ document_id: string; snippet: string }> = [];
  if (question.trim()) {
    try {
      const vec = await embed(question);
      const [{ data: matches }, { data: memMatches }] = await Promise.all([
        service.rpc("match_chunks", { query_embedding: vec, p_company_id: company.id, match_count: 3 }),
        service.rpc("match_memories", { query_embedding: vec, p_company_id: company.id, match_count: 3 }),
      ]);
      if (Array.isArray(matches) && matches.length) {
        sources = matches.map((m: any) => ({ document_id: m.document_id, snippet: truncate(m.content, 220) }));
      }
      const chunkCtx = (matches ?? []).map((m: any, i: number) => `[Документ ${i + 1}] ${m.content}`).join("\n\n");
      const memCtx = (memMatches ?? []).map((m: any, i: number) => `[Память ${i + 1}] ${m.content}`).join("\n\n");
      context = [chunkCtx, memCtx].filter(Boolean).join("\n\n");
    } catch (e) {
      console.error("team RAG error", e);
    }
  }

  const system: ChatMessage = {
    role: "system",
    content:
      `Ты — ${company.assistant_name}, AI-ассистент компании «${company.name}», включённый в командный чат.\n` +
      `Отвечай кратко и по делу — другие сотрудники читают тоже.\n` +
      (context ? `\nКонтекст компании:\n${context}` : ""),
  };
  const messages: ChatMessage[] = [
    system,
    ...ordered.map<ChatMessage>((m) => ({
      role: m.is_ai ? "assistant" : "user",
      content: m.content,
    })),
  ];

  let content = "";
  try {
    const res = await chatCompletion(messages, { model: MODELS.main, max_tokens: 800 });
    content = res.choices[0]?.message?.content ?? "";
  } catch (e) {
    const detail = (e as Error).message || "unknown";
    await service.from("messages").insert({
      channel_id,
      user_id: null,
      content: `⚠️ Ошибка ассистента: ${detail}`,
      is_ai: true,
    });
    return Response.json({ ok: false, error: detail }, { status: 502 });
  }

  await service.rpc("increment_usage", {
    p_company_id: company.id,
    p_period: period,
    p_requests: 1,
    p_actions: 0,
  });

  await service.from("messages").insert({
    channel_id,
    user_id: null,
    content,
    is_ai: true,
    sources: sources.length ? sources : null,
  });

  return Response.json({ ok: true });
}
