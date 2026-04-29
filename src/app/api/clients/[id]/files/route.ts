import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "client-files";

async function ensureBucket(service: ReturnType<typeof createServiceClient>) {
  try {
    const { data } = await service.storage.getBucket(BUCKET);
    if (data) return;
  } catch {}
  try {
    await service.storage.createBucket(BUCKET, { public: false });
  } catch {}
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) return new Response("no company", { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const kind = (form.get("kind") as string | null) ?? "other";
  if (!file) return new Response("no file", { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const fileId = crypto.randomUUID();
  const storagePath = `${companyId}/${params.id}/${fileId}.${ext}`;

  const service = createServiceClient();
  await ensureBucket(service);
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return new Response(`upload failed: ${upErr.message}`, { status: 500 });

  const { data, error } = await supabase
    .from("client_files")
    .insert({
      id: fileId,
      client_id: params.id,
      uploaded_by: user.id,
      name: file.name,
      size_bytes: buf.length,
      mime: file.type || null,
      storage_path: storagePath,
      kind,
    })
    .select("id, name, size_bytes, mime, kind, storage_path, created_at")
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ file: data });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("client_files")
    .select("id, name, size_bytes, mime, kind, storage_path, created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ files: data ?? [] });
}
