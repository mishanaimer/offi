import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "client-files";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("client_files")
    .select("storage_path, name, mime")
    .eq("id", params.fileId)
    .eq("client_id", params.id)
    .single();
  if (error || !row) return new Response("file not found", { status: 404 });

  const service = createServiceClient();
  const { data: signed } = await service.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60 * 10);
  if (!signed?.signedUrl) return new Response("cannot sign url", { status: 500 });
  return Response.json({ url: signed.signedUrl, name: row.name, mime: row.mime });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createClient();
  const { data: row } = await supabase
    .from("client_files")
    .select("storage_path")
    .eq("id", params.fileId)
    .eq("client_id", params.id)
    .single();
  if (row?.storage_path) {
    const service = createServiceClient();
    await service.storage.from(BUCKET).remove([row.storage_path]);
  }
  await supabase.from("client_files").delete().eq("id", params.fileId);
  return Response.json({ ok: true });
}
