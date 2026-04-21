import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Диагностика RouterAI: пингует /chat/completions без streaming и возвращает
 * РЕАЛЬНЫЙ ответ и статус. Открой в браузере: /api/diag
 * или: /api/diag?model=claude-sonnet-4.6 — чтобы проверить другое имя модели.
 * Ничего не коммитит, безопасно оставлять — ответ не попадает в БД.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.ROUTERAI_API_KEY;
  const baseUrl = process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1";
  const modelOverride = req.nextUrl.searchParams.get("model");
  const model = modelOverride ?? process.env.ROUTERAI_MAIN_MODEL ?? "claude-sonnet-4-6";
  const routerModel = process.env.ROUTERAI_ROUTER_MODEL ?? "deepseek-v3.2";
  const embeddingModel = process.env.ROUTERAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  const env = {
    ROUTERAI_API_KEY: apiKey ? `set (${apiKey.length} chars, starts "${apiKey.slice(0, 6)}...")` : "MISSING",
    ROUTERAI_BASE_URL: baseUrl,
    ROUTERAI_MAIN_MODEL: model,
    ROUTERAI_ROUTER_MODEL: routerModel,
    ROUTERAI_EMBEDDING_MODEL: embeddingModel,
  };

  if (!apiKey) {
    return Response.json({
      ok: false,
      stage: "env",
      env,
      hint: "Добавь ROUTERAI_API_KEY в .env.local и перезапусти dev-сервер (`Ctrl+C` → `npm run dev`).",
    }, { status: 500 });
  }

  // Пинг
  const results: Record<string, unknown> = { env };

  // 1) /models — есть ли вообще такой эндпоинт
  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    results.models = {
      status: r.status,
      sample: (await r.text()).slice(0, 600),
    };
  } catch (e) {
    results.models = { error: (e as Error).message };
  }

  // 2) /chat/completions на main-модели, non-streaming
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Скажи 'ok' одним словом." }],
        max_tokens: 20,
        temperature: 0,
      }),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    results.chat_main = {
      status: r.status,
      ok: r.ok,
      content: parsed?.choices?.[0]?.message?.content ?? null,
      raw: text.slice(0, 800),
    };
  } catch (e) {
    results.chat_main = { error: (e as Error).message };
  }

  // 3) embeddings
  try {
    const r = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: embeddingModel, input: "ping" }),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    results.embeddings = {
      status: r.status,
      ok: r.ok,
      vector_length: parsed?.data?.[0]?.embedding?.length ?? null,
      raw: text.slice(0, 400),
    };
  } catch (e) {
    results.embeddings = { error: (e as Error).message };
  }

  return Response.json(results, { status: 200 });
}
