import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { chunkText, embedBatch } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body =
  | { source: "url"; value: string; name?: string; companyId?: string }
  | { source: "text"; value: string; name?: string; companyId?: string };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let companyId = body.companyId;
  if (!companyId) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
    companyId = profile?.company_id ?? undefined;
  }
  if (!companyId) return new Response("no company", { status: 400 });

  let text = "";
  let name = body.name ?? "";
  let sourceUrl: string | null = null;

  if (body.source === "url") {
    sourceUrl = body.value;
    text = await fetchAndExtract(body.value);
    if (!name) name = new URL(body.value).host;
  } else if (body.source === "text") {
    text = body.value;
    if (!name) name = "Текстовая заметка";
  }

  if (!text.trim()) return new Response("empty content", { status: 400 });

  const service = createServiceClient();
  const { data: doc, error } = await service
    .from("documents")
    .insert({
      company_id: companyId,
      name,
      source_type: body.source,
      source_url: sourceUrl,
      status: "processing",
    })
    .select()
    .single();
  if (error) return new Response(error.message, { status: 500 });

  const chunks = chunkText(text);
  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(slice);
    const rows = slice.map((content, j) => ({
      document_id: doc.id,
      company_id: companyId,
      content,
      embedding: vectors[j] as any,
      idx: i + j,
      token_count: Math.ceil(content.length / 3),
    }));
    await service.from("chunks").insert(rows);
  }

  await service.from("documents").update({ status: "ready", chunks_count: chunks.length }).eq("id", doc.id);

  return Response.json({ ok: true, document_id: doc.id, chunks: chunks.length });
}

async function fetchAndExtract(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "OffiBot/1.0" } });
  const html = await res.text();
  // примитивный HTML→text: вырезаем script/style, потом теги
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}
