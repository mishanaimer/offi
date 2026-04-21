import { MODELS } from "./ai";

const BASE_URL = process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1";
const API_KEY = process.env.ROUTERAI_API_KEY ?? "";
const TARGET_DIM = parseInt(process.env.ROUTERAI_EMBEDDING_DIM ?? "1536", 10);

/** Подрезает/паддит вектор до TARGET_DIM (если модель вернула больше/меньше). */
function normalize(vec: number[]): number[] {
  if (vec.length === TARGET_DIM) return vec;
  if (vec.length > TARGET_DIM) return vec.slice(0, TARGET_DIM);
  return [...vec, ...Array(TARGET_DIM - vec.length).fill(0)];
}

async function call(body: object): Promise<Response> {
  if (!API_KEY) throw new Error("ROUTERAI_API_KEY is not set");
  return fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
}

async function callWithRetry(input: string | string[]): Promise<number[][]> {
  // Сначала пробуем с dimensions — OpenAI-compatible, большинство моделей игнорит без ошибки.
  // Если сервер ругается — повторяем без параметра.
  const withDim = { model: MODELS.embedding, input, dimensions: TARGET_DIM };
  const withoutDim = { model: MODELS.embedding, input };

  let res = await call(withDim);
  if (!res.ok) {
    const text = await res.text();
    if (/dimensions|parameter|unknown/i.test(text)) {
      res = await call(withoutDim);
    } else {
      throw new Error(`Embeddings: ${res.status} ${text}`);
    }
  }
  if (!res.ok) throw new Error(`Embeddings: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => normalize(d.embedding));
}

/** Получить embedding для одной строки (нормализован до TARGET_DIM, по умолчанию 1536). */
export async function embed(text: string): Promise<number[]> {
  const [vec] = await callWithRetry(text.slice(0, 8000));
  return vec;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return callWithRetry(texts.map((t) => t.slice(0, 8000)));
}

/**
 * Разбивает текст на чанки ~ CHUNK_SIZE токенов с перекрытием OVERLAP.
 * Токены аппроксимируются через 3 символа ≈ 1 токен (ru-текст).
 */
const CHUNK_SIZE = 800;
const OVERLAP = 150;
const CHARS_PER_TOKEN = 3;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+\n/g, "\n").trim();
  const paragraphs = normalized.split(/\n{2,}/);

  const chunks: string[] = [];
  let current = "";

  const targetChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP * CHARS_PER_TOKEN;

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > targetChars && current) {
      chunks.push(current.trim());
      current = current.slice(-overlapChars) + "\n\n" + p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
