import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { chunkText, embedBatch } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  const companyId = profile?.company_id;
  if (!companyId) return new Response("no company", { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return new Response("no file", { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const text = await extractText(file.name, buf);
  if (!text || text.trim().length < 20) {
    return new Response("could not extract text", { status: 400 });
  }

  const service = createServiceClient();

  // store file in storage (optional — bucket "documents")
  let fileUrl: string | null = null;
  try {
    const path = `${companyId}/${Date.now()}-${file.name}`;
    const { error } = await service.storage.from("documents").upload(path, buf, { contentType: file.type });
    if (!error) {
      fileUrl = service.storage.from("documents").getPublicUrl(path).data.publicUrl;
    }
  } catch {}

  const { data: doc, error: docErr } = await service
    .from("documents")
    .insert({
      company_id: companyId,
      name: file.name,
      source_type: "file",
      file_url: fileUrl,
      size_bytes: file.size,
      status: "processing",
    })
    .select()
    .single();
  if (docErr) return new Response(docErr.message, { status: 500 });

  await ingestChunks(service, companyId, doc.id, text);

  return Response.json({ ok: true, document_id: doc.id });
}

async function extractText(name: string, buf: Buffer): Promise<string> {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    const pdf = (await import("pdf-parse")).default;
    return (await pdf(buf)).text;
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (ext === "csv" || ext === "txt" || ext === "md") {
    return buf.toString("utf8");
  }
  if (ext === "xlsx") {
    // простая реализация через csv-пересохранение — для MVP достаточно .xlsx → text
    return buf.toString("utf8");
  }
  return buf.toString("utf8");
}

async function ingestChunks(service: ReturnType<typeof createServiceClient>, companyId: string, documentId: string, text: string) {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await service.from("documents").update({ status: "error" }).eq("id", documentId);
    return;
  }

  // embed in batches of 50
  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(slice);
    const rows = slice.map((content, j) => ({
      document_id: documentId,
      company_id: companyId,
      content,
      embedding: vectors[j] as any,
      idx: i + j,
      token_count: Math.ceil(content.length / 3),
    }));
    await service.from("chunks").insert(rows);
  }

  await service.from("documents").update({ status: "ready", chunks_count: chunks.length }).eq("id", documentId);
}
