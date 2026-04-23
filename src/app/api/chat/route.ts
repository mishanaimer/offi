import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { chatCompletionStream, classify, MODELS, type ChatMessage } from "@/lib/ai";
import { embed } from "@/lib/embeddings";
import { truncate } from "@/lib/utils";
import { scheduleFactExtraction } from "@/lib/memory";
import { currentPeriod, getPlan } from "@/lib/plans";
import { ACTION_TOOLS } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = (assistantName: string, companyName: string, withTools: boolean) =>
  `Ты — ${assistantName}, встроенный AI-агент внутри корпоративной платформы Offi для компании «${companyName}».
Это НЕ публичный чат — ты работаешь изнутри CRM/базы знаний конкретной компании. У тебя ЕСТЬ доступ к:
— базе клиентов (clients) этой компании (используй инструмент find_client)
— шаблонам документов и генерации договоров (generate_document)
— корпоративной памяти: факты, договорённости, правила (remember_fact и RAG-контекст)
— отправке email (Postmark) и Telegram от имени сотрудника (send_email / send_telegram)
— календарю и встречам (create_meeting / add_to_calendar)
— файлам, прикреплённым к сообщению (они уже в базе знаний и подтянуты в контекст)

СТРОГИЕ ПРАВИЛА:
1. НИКОГДА не пиши «у меня нет доступа», «я не могу посмотреть», «у меня нет информации о клиентах», «я не имею доступа к CRM/базе». Доступ есть. Если нужны данные клиента — сразу вызови find_client. Если не знаешь имя — спроси одним коротким вопросом.
2. Если пользователь упомянул клиента по имени (даже частичному, например «Сергей») — ВЫЗЫВАЙ find_client с query=<имя>, не переспрашивай «какой именно» до первого поиска.
3. Никогда не выдавай фраз вроде «я просто переспрашивал» — если не вызвал инструмент, значит задача ещё не решена; лучше уточни или сразу вызови.
4. Отвечай кратко, по-русски, без воды. Не выдумывай цифр, цен и фактов — если в базе знаний/памяти этого нет, так и скажи и предложи добавить.
5. Когда опираешься на контекст из базы знаний или памяти — упоминай источник естественно, без сносок.${
    withTools
      ? `\n\nДоступные инструменты (вызывай их для действий — не описывай словами, вызывай):
- send_email / send_telegram — отправить сообщение (покажется подтверждение пользователю)
- create_meeting / add_to_calendar — запланировать встречу
- find_client — найти клиента в CRM по имени / контакту / части имени
- generate_document — сгенерировать документ из шаблона
- remember_fact — сохранить факт в память компании

Когда пользователь просит «найди», «покажи клиента», «кто наши клиенты», «отправь», «составь договор», «запланируй» — это сигнал вызвать инструмент немедленно. Если критичных параметров нет — задай ОДИН короткий уточняющий вопрос, потом вызови.`
      : ""
  }`;

type ReqBody = {
  channelId: string | null;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(req: NextRequest) {
  const { message, history = [], channelId: reqChannelId }: ReqBody = await req.json();
  if (!message?.trim()) return new Response("empty message", { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company:companies(id, name, assistant_name, plan)")
    .eq("id", user.id)
    .single();
  const company = profile?.company as any;
  if (!company) return new Response("no company", { status: 400 });

  const service = createServiceClient();

  // --- гарантируем AI-канал: если клиент не передал id — создаём новый,
  // чтобы сообщения не терялись (исторически первое сообщение до онбординга
  // или после неудачного new-session оставалось без channel_id).
  let channelId: string | null = reqChannelId;
  if (!channelId) {
    const { data: existing } = await service
      .from("channels")
      .select("id")
      .eq("company_id", company.id)
      .eq("type", "ai")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    channelId = existing?.id ?? null;
  }
  if (!channelId) {
    const { data: newChan } = await service
      .from("channels")
      .insert({
        company_id: company.id,
        name: `Диалог от ${new Date().toLocaleDateString("ru-RU")}`,
        type: "ai",
        created_by: user.id,
      })
      .select("id")
      .single();
    channelId = newChan?.id ?? null;
  }
  const createdNewChannel = channelId !== reqChannelId;

  // --- Лимит запросов по тарифу ---
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
    return Response.json(
      {
        error: "limit_exceeded",
        detail: `Исчерпан лимит AI-запросов на месяц (${plan.limits.requests}) по тарифу «${plan.name}».`,
        hint: "Перейдите на тариф выше в Настройки → Тарифы.",
      },
      { status: 402 }
    );
  }

  // --- Router: определяем тип запроса ---
  let type: "question" | "action" | "smalltalk" = "question";
  try {
    const cls = await classify(message);
    type = cls.type;
  } catch {}

  // --- Dual RAG: chunks + memories ---
  let context = "";
  let sources: Array<{ document_id: string; snippet: string; name?: string }> = [];
  let memorySources: Array<{ id: string; content: string }> = [];

  if (type !== "smalltalk") {
    try {
      const vec = await embed(message);

      const [{ data: matches }, { data: memMatches }] = await Promise.all([
        service.rpc("match_chunks", {
          query_embedding: vec,
          p_company_id: company.id,
          match_count: 3,
        }),
        service.rpc("match_memories", {
          query_embedding: vec,
          p_company_id: company.id,
          match_count: 3,
        }),
      ]);

      if (Array.isArray(matches) && matches.length) {
        sources = matches.map((m: any) => ({
          document_id: m.document_id,
          snippet: truncate(m.content, 220),
        }));
      }
      if (Array.isArray(memMatches) && memMatches.length) {
        memorySources = memMatches.map((m: any) => ({
          id: m.id,
          content: truncate(m.content, 220),
        }));
      }

      const chunkCtx = (matches ?? [])
        .map((m: any, i: number) => `[Документ ${i + 1}] ${m.content}`)
        .join("\n\n");
      const memCtx = (memMatches ?? [])
        .map((m: any, i: number) => `[Память ${i + 1}] ${m.content}`)
        .join("\n\n");

      context = [chunkCtx, memCtx].filter(Boolean).join("\n\n");
    } catch (e) {
      console.error("RAG error", e);
    }
  }

  // Передаём tools всем типам, кроме чистого smalltalk — классификатор часто
  // недооценивает «найди клиента» / «пришли письмо» и относит их к question.
  const withTools = type !== "smalltalk";
  const systemPrompt = SYSTEM_PROMPT(company.assistant_name, company.name, withTools);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        systemPrompt +
        (context ? `\n\nКонтекст компании:\n${context}` : ""),
    },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  // --- сохраняем сообщение пользователя + инкремент счётчика ---
  let savedUserMsgId: string | null = null;
  if (channelId) {
    const { data: inserted } = await service
      .from("messages")
      .insert({
        channel_id: channelId,
        user_id: user.id,
        content: message,
        is_ai: false,
      })
      .select("id")
      .single();
    savedUserMsgId = inserted?.id ?? null;
  }

  await service.rpc("increment_usage", {
    p_company_id: company.id,
    p_period: period,
    p_requests: 1,
    p_actions: 0,
  });

  // --- фоновая экстракция фактов (не блокирует стрим) ---
  scheduleFactExtraction(message, {
    companyId: company.id,
    userId: user.id,
    sourceId: savedUserMsgId,
  });

  // --- streaming ответа ---
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await chatCompletionStream(messages, {
      model: MODELS.main,
      ...(withTools ? { tools: ACTION_TOOLS, tool_choice: "auto" } : {}),
    });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    console.error("RouterAI stream error:", msg);
    return Response.json(
      {
        error: "routerai_failed",
        detail: msg,
        hint: "Проверь ROUTERAI_API_KEY, ROUTERAI_BASE_URL и ROUTERAI_MAIN_MODEL. Перезапусти dev-сервер после правки .env.local.",
      },
      { status: 502 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      if (createdNewChannel && channelId) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "session", channelId })}\n\n`
          )
        );
      }
      if (sources.length || memorySources.length) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", sources, memories: memorySources })}\n\n`
          )
        );
      }

      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      const toolCalls: Record<number, { id: string; name: string; arguments: string }> = {};

      // --- Прогрессивное сохранение AI-сообщения ---
      // Чтобы ответ не терялся при обрыве стрима (переход между вкладками),
      // вставляем строку при первой дельте и обновляем раз в ~700мс.
      let aiRowId: string | null = null;
      let lastSaveAt = 0;
      let savingPromise: Promise<any> | null = null;

      const persistAi = async (final: boolean) => {
        if (!channelId) return;
        const now = Date.now();
        if (!final && now - lastSaveAt < 700) return;
        if (!full && !final) return;
        if (savingPromise && !final) return; // пропустить, если ещё пишется предыдущее
        lastSaveAt = now;

        const task = (async () => {
          try {
            if (!aiRowId) {
              const { data } = await service
                .from("messages")
                .insert({
                  channel_id: channelId,
                  user_id: null,
                  content: full,
                  is_ai: true,
                  sources: sources.length ? sources : null,
                })
                .select("id")
                .single();
              aiRowId = data?.id ?? null;
            } else {
              await service
                .from("messages")
                .update({
                  content: full,
                  sources: sources.length ? sources : null,
                })
                .eq("id", aiRowId);
            }
          } catch (e) {
            console.error("persistAi failed:", (e as Error).message);
          }
        })();
        savingPromise = task;
        try {
          await task;
        } finally {
          if (savingPromise === task) savingPromise = null;
        }
      };

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
                try {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`)
                  );
                } catch {
                  // клиент отвалился — продолжаем копить, чтобы сохранить в БД
                }
                // фоновая запись (не блокируем стрим)
                void persistAi(false);
              }
              // Агрегируем tool_calls: OpenAI-совместимый формат, arguments идут чанками.
              const tc = json.choices?.[0]?.delta?.tool_calls;
              if (Array.isArray(tc)) {
                for (const c of tc) {
                  const idx: number = c.index ?? 0;
                  if (!toolCalls[idx]) toolCalls[idx] = { id: "", name: "", arguments: "" };
                  if (c.id) toolCalls[idx].id = c.id;
                  if (c.function?.name) toolCalls[idx].name = c.function.name;
                  if (c.function?.arguments) toolCalls[idx].arguments += c.function.arguments;
                }
              }
            } catch {}
          }
        }
      } catch (e) {
        console.error("stream error", e);
      } finally {
        const calls = Object.values(toolCalls)
          .filter((c) => c.name)
          .map((c) => {
            let args: Record<string, unknown> = {};
            try {
              args = c.arguments ? JSON.parse(c.arguments) : {};
            } catch {}
            return { id: c.id || crypto.randomUUID(), name: c.name, arguments: args };
          });

        if (calls.length) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool_calls", calls })}\n\n`)
            );
          } catch {}
        }

        try {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch {}

        // Дождаться незавершившейся записи и сделать финальный upsert с полным текстом.
        if (savingPromise) {
          try { await savingPromise; } catch {}
        }
        if (channelId && (full || calls.length)) {
          const finalContent =
            full || `[Предложены действия: ${calls.map((c) => c.name).join(", ")}]`;
          try {
            if (aiRowId) {
              await service
                .from("messages")
                .update({
                  content: finalContent,
                  sources: sources.length ? sources : null,
                })
                .eq("id", aiRowId);
            } else {
              await service.from("messages").insert({
                channel_id: channelId,
                user_id: null,
                content: finalContent,
                is_ai: true,
                sources: sources.length ? sources : null,
              });
            }
          } catch (e) {
            console.error("final AI save failed:", (e as Error).message);
          }
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
