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
— базе клиентов (clients) с реквизитами, подписантом, банком, статусом, тегами и владельцем — через find_client / get_client / list_clients;
— заметкам и истории общения по клиенту (save_client_note / поле notes в get_client);
— файлам, прикреплённым к карточке клиента (kind: card / contract / invoice / other);
— шаблонам DOCX-договоров компании (list_contract_templates) и генерации договоров (ai_create_contract — реквизиты подставит сам);
— текстовым шаблонам писем / КП (list_text_templates / create_text_template / update_text_template / delete_text_template). В шаблонах используй переменную {{client.greeting}} для приветствия (имя контакта или короткое название компании), {{client.name}} для названия, {{user.name}} для отправителя. Никогда не вшивай конкретное имя клиента в шаблон;
— реестру ранее сгенерированных договоров (list_contracts) с прямыми ссылками на скачивание;
— созданию новых клиентов (create_client) с реквизитами и тегами;
— корпоративной памяти: факты, договорённости, правила (remember_fact + RAG-контекст). Память может быть привязана к клиенту через client_id;
— отправке email (Postmark) и Telegram от имени сотрудника (send_email / send_telegram);
— календарю и встречам (create_meeting / add_to_calendar);
— файлам, прикреплённым к сообщению (они уже в базе знаний и подтянуты в контекст).

ЦЕПОЧКИ ВЫЗОВОВ (важно — это работает, делай так):
• «Составь договор для X» → list_contract_templates → find_client(X) → get_client(client_id) → ai_create_contract({client_id, template_id, variables}). Реквизиты НЕ переспрашивай — они уже в карточке.
• «Что мы знаем про X» → find_client(X) → get_client(id) → пересказать summary, статус, тэги, последний контакт, договоры.
• «Создай шаблон письма для X» / «придумай КП-шаблон» → create_text_template({name, body}). Body пиши на markdown, с переменными {{client.greeting}}, {{client.name}}, {{user.name}}. Никогда не вшивай конкретное имя — оно подставится автоматически.
• «Поправь шаблон «Y»: добавь Z» → list_text_templates → найти id → update_text_template({template_id, body}).
• «Добавь нового клиента: ООО Альфа, ИНН 7707…, контакт Иван» → create_client(...). Если пользователь указал, что компания — клиент текущего работающего проекта, ставь status=active, иначе lead.
• «Отправь Y договор/КП» → найти клиента → ai_create_contract → send_email(to=client.email, attach=download_url).
• Если пользователь сообщил новый факт о клиенте (любимый формат связи, скидка, контактное лицо, банк) — сохрани через save_client_note (для разовой инфо) или remember_fact с client_id (для долгого факта).
• После генерации договора в ответе пользователю ДАЙ ссылку на скачивание из download_url.

СТРОГИЕ ПРАВИЛА:
1. НИКОГДА не пиши «у меня нет доступа», «не могу посмотреть базу», «нет данных о клиентах». Доступ есть — вызывай тулы.
2. Если упомянут клиент даже частично («Сергей», «Ромашка», «по ИНН 7707») — сразу find_client. Не уточняй «какой именно» до первого поиска.
3. Не выдумывай ИНН, реквизиты, банковские счета. Если в карточке клиента поле пустое — вызови update_client после уточнения у пользователя.
4. Отвечай кратко, по-русски. Когда опираешься на данные из карточки/памяти — упоминай естественно («По карточке клиента: ИНН 7707…»).
5. После выполнения тулов синтезируй ответ человеку — не просто «выполнено», а итог: какой клиент найден, какой договор создан, ссылка для скачивания, что делать дальше.${
    withTools
      ? `\n\nИнструменты:
— find_client / get_client / list_clients / create_client / update_client / save_client_note — клиенты;
— list_text_templates / create_text_template / update_text_template / delete_text_template — текстовые шаблоны (письма, КП);
— list_contract_templates / list_contracts / ai_create_contract — договоры (DOCX);
— remember_fact — память (используй client_id если факт про клиента);
— send_email / send_telegram — коммуникации (требуют подтверждения);
— create_meeting / add_to_calendar — встречи.

Триггеры: «найди / покажи клиента / кто наши клиенты» → list_clients/find_client; «составь / сформируй / сделай договор» → ai_create_contract; «запиши / запомни» → remember_fact или save_client_note. Ни в коем случае не отвечай словами «я бы вызвал…» — просто вызови.`
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

  // --- сохраняем сообщение пользователя СИНХРОННО (нужен id для memory),
  //     но запросы в фоне не дожидаемся (это всего 1 INSERT) ---
  const userInsertPromise = channelId
    ? service
        .from("messages")
        .insert({
          channel_id: channelId,
          user_id: user.id,
          content: message,
          is_ai: false,
        })
        .select("id")
        .single()
    : Promise.resolve({ data: null } as any);

  // Инкремент счётчика — в фоне, не блокирует стрим.
  void service.rpc("increment_usage", {
    p_company_id: company.id,
    p_period: period,
    p_requests: 1,
    p_actions: 0,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // ⚡️ Сразу после открытия стрима шлём keepalive-комментарий —
      // это «прорывает» прокси-буферизацию (Vercel/Nginx) и подтверждает
      // клиенту что коннект жив, пока идёт RAG/CRM-подготовка.
      try {
        controller.enqueue(encoder.encode(`: connected\n\n`));
      } catch {}

      // Heartbeat каждые 10 сек — на случай долгих tool-вызовов или RAG
      // не даёт прокси/браузеру разорвать idle-коннект.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 10_000);

      if (createdNewChannel && channelId) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "session", channelId })}\n\n`
            )
          );
        } catch {}
      }

      // --- Параллельно: classify + embedding + CRM-сводка ---
      const classifyPromise = classify(message).catch(() => ({ type: "question" as const, confidence: 0.5 }));
      const embedPromise = embed(message).catch((e) => {
        console.error("embed error", e);
        return null;
      });

      // CRM-сводку начинаем сразу — она не зависит от RAG.
      const crmPromise = (async () => {
        try {
          const [
            { data: clientsBrief },
            { data: tplsBrief },
            { data: contractsBrief },
            { data: textTplsBrief },
          ] = await Promise.all([
            service
              .from("clients")
              .select("id, short_name, name, status, inn, last_contact_at")
              .eq("company_id", company.id)
              .order("last_contact_at", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
              .limit(10),
            service
              .from("contract_templates")
              .select("id, name, description")
              .eq("company_id", company.id)
              .order("created_at", { ascending: false })
              .limit(10),
            service
              .from("generated_contracts")
              .select("id, name, client_id, created_at")
              .eq("company_id", company.id)
              .order("created_at", { ascending: false })
              .limit(5),
            service
              .from("templates")
              .select("id, name")
              .eq("company_id", company.id)
              .order("created_at", { ascending: false })
              .limit(10),
          ]);
          const cBlock = (clientsBrief ?? [])
            .map(
              (c: any) =>
                `- ${c.short_name || c.name}${c.inn ? ` (ИНН ${c.inn})` : ""} · status: ${c.status ?? "—"} · id: ${c.id}`
            )
            .join("\n");
          const tBlock = (tplsBrief ?? [])
            .map((t: any) => `- «${t.name}»${t.description ? ` — ${truncate(t.description, 80)}` : ""} · id: ${t.id}`)
            .join("\n");
          const gBlock = (contractsBrief ?? [])
            .map((g: any) => `- ${g.name ?? g.id} · client_id: ${g.client_id ?? "—"} · ${g.created_at?.slice(0, 10)}`)
            .join("\n");
          const sections: string[] = [];
          if (cBlock) sections.push(`Последние клиенты (id для тулов):\n${cBlock}`);
          else sections.push("В CRM пока нет клиентов — предложи добавить.");
          if (tBlock) sections.push(`Шаблоны договоров (id для ai_create_contract):\n${tBlock}`);
          else sections.push("Шаблонов договоров пока нет — предложи загрузить .docx в Документы → Договоры.");
          if (gBlock) sections.push(`Последние договоры:\n${gBlock}`);
          const textTplBlock = (textTplsBrief ?? [])
            .map((t: any) => `- «${t.name}» · id: ${t.id}`)
            .join("\n");
          if (textTplBlock) sections.push(`Текстовые шаблоны (id для update/delete_text_template):\n${textTplBlock}`);
          return "\n\nСнимок CRM (актуальный):\n" + sections.join("\n\n");
        } catch (e) {
          console.error("crm summary error", (e as Error).message);
          return "";
        }
      })();

      // Получаем тип запроса (нужен для решения «звать ли RAG»)
      const cls = await classifyPromise;
      const type: "question" | "action" | "smalltalk" = cls.type;
      const withTools = type !== "smalltalk";

      // Embedding и матчи зависят от type (не дёргаем для smalltalk)
      let context = "";
      let sources: Array<{ document_id: string; snippet: string; name?: string }> = [];
      let memorySources: Array<{ id: string; content: string }> = [];

      if (type !== "smalltalk") {
        try {
          const vec = await embedPromise;
          if (vec) {
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
          }
        } catch (e) {
          console.error("RAG error", e);
        }
      }

      const systemPrompt = SYSTEM_PROMPT(company.assistant_name, company.name, withTools);
      const crmSummary = withTools ? await crmPromise : "";

      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            systemPrompt +
            (context ? `\n\nКонтекст компании:\n${context}` : "") +
            crmSummary,
        },
        ...history.slice(-8).map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
        { role: "user", content: message },
      ];

      // Дожидаемся записи user-сообщения (нужен id для memory)
      const userIns = await userInsertPromise;
      const savedUserMsgId: string | null = (userIns as any)?.data?.id ?? null;

      // Фоновая экстракция фактов (не блокирует стрим)
      scheduleFactExtraction(message, {
        companyId: company.id,
        userId: user.id,
        sourceId: savedUserMsgId,
      });

      if (sources.length || memorySources.length) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "sources", sources, memories: memorySources })}\n\n`
            )
          );
        } catch {}
      }

      // --- streaming ответа от LLM ---
      let upstream: ReadableStream<Uint8Array>;
      try {
        upstream = await chatCompletionStream(messages, {
          model: MODELS.main,
          ...(withTools ? { tools: ACTION_TOOLS, tool_choice: "auto" } : {}),
        });
      } catch (e) {
        const errMsg = (e as Error).message ?? "unknown";
        console.error("RouterAI stream error:", errMsg);
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: "routerai_failed",
                detail: errMsg,
                hint: "Проверь ROUTERAI_API_KEY, ROUTERAI_BASE_URL и ROUTERAI_MAIN_MODEL.",
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch {}
        clearInterval(heartbeat);
        return;
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

        clearInterval(heartbeat);

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
      // Отключает буферизацию у Nginx/Vercel/любых reverse-proxy на пути.
      // Без этого SSE может накапливаться пакетами по килобайту и
      // токены будут идти «рывками».
      "X-Accel-Buffering": "no",
    },
  });
}
