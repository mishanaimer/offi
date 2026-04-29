import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "template-images";

const ACCEPT = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"]);

async function ensureBucket(service: ReturnType<typeof createServiceClient>) {
  try {
    const { data } = await service.storage.getBucket(BUCKET);
    if (data) return;
  } catch {}
  try {
    await service.storage.createBucket(BUCKET, { public: true });
  } catch {}
}

export async function POST(req: NextRequest) {
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
  if (!file) return new Response("no file", { status: 400 });
  if (file.size > 8 * 1024 * 1024) return new Response("файл больше 8 МБ", { status: 400 });
  const mime = file.type || "application/octet-stream";
  if (!ACCEPT.has(mime)) return new Response(`неподдерживаемый формат: ${mime}`, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const key = `${companyId}/${crypto.randomUUID()}.${ext}`;

  const service = createServiceClient();
  await ensureBucket(service);
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: mime, upsert: false });
  if (upErr) return new Response(`upload failed: ${upErr.message}`, { status: 500 });

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(key);
  if (!pub?.publicUrl) return new Response("cannot get public url", { status: 500 });
  return Response.json({ url: pub.publicUrl, mime, size: buf.length, name: file.name });
}
