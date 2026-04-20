import { MODELS } from "./ai";

const BASE_URL = process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1";
const API_KEY = process.env.ROUTERAI_API_KEY ?? "";

/** Получить embedding для одной строки (1536-мерный вектор). */
export async function embed(text: string): Promise<number[]> {
  if (!API_KEY) throw new Error("ROUTERAI_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODELS.embedding,
      input: text.slice(0, 8000),
    }),
  });
  if (!res.ok) throw new Error(`Embeddings: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!API_KEY) throw new Error("ROUTERAI_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODELS.embedding,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  });
  if (!res.ok) throw new Error(`Embeddings batch: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

/**
 * Разбивает текст на чанки ~ CHUNK_SIZE токенов с перекрытием OVERLAP.
 * Токены аппроксимируются через 4 символа ≈ 1 токен (ru-текст ближе к 2-3).
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
