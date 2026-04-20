/**
 * RouterAI.ru клиент — OpenAI-совместимый API для DeepSeek/Claude через единый endpoint.
 * Поддерживает: классификатор (DeepSeek V3.2), основной чат (Claude Sonnet 4.6), embeddings.
 */

const BASE_URL = process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1";
const API_KEY = process.env.ROUTERAI_API_KEY ?? "";

export const MODELS = {
  router: process.env.ROUTERAI_ROUTER_MODEL ?? "deepseek-v3.2",
  main: process.env.ROUTERAI_MAIN_MODEL ?? "claude-sonnet-4-6",
  embedding: process.env.ROUTERAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
} as const;

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }>;
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
};

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  if (!API_KEY) throw new Error("ROUTERAI_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model ?? MODELS.main,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 1500,
      stream: false,
      tools: options.tools,
      tool_choice: options.tool_choice,
    }),
  });
  if (!res.ok) throw new Error(`RouterAI: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{
    choices: Array<{
      message: ChatMessage;
      finish_reason: string;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>;
}

/** Streaming — возвращает ReadableStream с SSE-совместимыми чанками */
export async function chatCompletionStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  if (!API_KEY) throw new Error("ROUTERAI_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model ?? MODELS.main,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 1500,
      stream: true,
      tools: options.tools,
      tool_choice: options.tool_choice,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`RouterAI stream: ${res.status} ${await res.text()}`);
  return res.body;
}

/** Классификатор: быстрый и дешёвый роут через DeepSeek. */
export type ClassifyResult = { type: "question" | "action" | "smalltalk"; confidence: number };

export async function classify(userText: string): Promise<ClassifyResult> {
  const result = await chatCompletion(
    [
      {
        role: "system",
        content:
          "Ты классификатор. Определи тип запроса пользователя. Верни ТОЛЬКО JSON вида {\"type\":\"question|action|smalltalk\",\"confidence\":0..1}. " +
          "question = вопрос по базе знаний или бизнесу. action = пользователь просит выполнить действие (отправить письмо, создать встречу и т.п.). smalltalk = приветствие, болтовня.",
      },
      { role: "user", content: userText },
    ],
    { model: MODELS.router, temperature: 0, max_tokens: 60 }
  );
  try {
    const text = result.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (parsed.type && typeof parsed.confidence === "number") return parsed as ClassifyResult;
  } catch {}
  return { type: "question", confidence: 0.5 };
}
