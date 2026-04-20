import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { chatCompletionStream, classify, MODELS, type ChatMessage } from "@/lib/ai";
import { embed } from "@/lib/embeddings";
import { truncate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = (assistantName: string, companyName: string) => `Ты — ${assistantName}, AI-ассистент компании «${companyName}».
Отвечай точно, кратко, по-русски. Когда опираешься на контекст из базы знаний — упоминай это естественно.
Если контекста не хватает — честно скажи «в документах этого нет, могу поискать общий ответ».
Не выдумывай цифр и фактов.`;

type ReqBody = {
  channelId: string | null;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(req: NextRequest) {
  const { message, history = [], channelId }: ReqBody = await req.json();
  if (!message?.trim()) return new Response("empty message", { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company:companies(id, name, assistant_name)")
    .eq("id", user.id)
    .single();
  const company = profile?.company as any;
  if (!company) return new Response("no company", { status: 400 });

  const service = createServiceClient();

  // --- Router: определяем тип запроса (question/action/smalltalk) ---
  let type: "question" | "action" | "smalltalk" = "question";
  try {
    const cls = await classify(message);
    type = cls.type;
  } catch {}

  // --- RAG: для вопросов подтягиваем релевантные чанки ---
  let context = "";
  let sources: Array<{ document_id: string; snippet: string }> = [];
  if (type === "question") {
    try {
      const vec = await embed(message);
      const { data: matches } = await service.rpc("match_chunks", {
        query_embedding: vec,
        p_company_id: company.id,
        match_count: 5,
      });
      if (Array.isArray(matches)) {
        sources = matches.map((m: any) => ({ document_id: m.document_id, snippet: truncate(m.content, 220) }));
        context = matches.map((m: any, i: number) => `[${i + 1}] ${m.content}`).join("\n\n");
      }
    } catch (e) {
      console.error("RAG error", e);
    }
  }

  const systemPrompt = SYSTEM_PROMPT(company.assistant_name, company.name);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        systemPrompt +
        (context ? `\n\nКонтекст из базы знаний компании:\n${context}` : ""),
    },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  // --- сохраняем сообщение пользователя ---
  if (channelId) {
    await service.from("messages").insert({
      channel_id: channelId,
      user_id: user.id,
      content: message,
      is_ai: false,
    });
  }

  // --- streaming ответ ---
  const upstream = await chatCompletionStream(messages, { model: MODELS.main });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // emit sources first
      if (sources.length) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`));
      }

      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                full += delta;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`));
              }
            } catch {}
          }
        }
      } catch (e) {
        console.error("stream error", e);
      } finally {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();

        // сохраняем итоговое сообщение ассистента
        if (channelId && full) {
          await service.from("messages").insert({
            channel_id: channelId,
            user_id: null,
            content: full,
            is_ai: true,
            sources: sources.length ? sources : null,
          });
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
