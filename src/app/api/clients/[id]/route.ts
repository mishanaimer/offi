import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_FULL_COLUMNS, pickClientFields } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const [
    { data: client, error: cErr },
    { data: notes },
    { data: files },
    { data: contracts },
    { data: memories },
  ] = await Promise.all([
    supabase.from("clients").select(CLIENT_FULL_COLUMNS).eq("id", params.id).single(),
    supabase
      .from("client_notes")
      .select("id, content, source, created_at, user_id")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("client_files")
      .select("id, name, size_bytes, mime, kind, storage_path, created_at")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_contracts")
      .select(
        "id, template_id, name, storage_path, download_url, warnings, created_at, contract_templates(name)"
      )
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("memories")
      .select("id, content, kind, source, created_at")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (cErr || !client) return new Response("client not found", { status: 404 });

  return Response.json({
    client,
    notes: notes ?? [],
    files: files ?? [],
    contracts: (contracts ?? []).map((r: any) => ({
      id: r.id,
      template_id: r.template_id,
      template_name: r.contract_templates?.name ?? null,
      name: r.name,
      storage_path: r.storage_path,
      download_url: r.download_url,
      warnings: r.warnings ?? null,
      created_at: r.created_at,
    })),
    memories: memories ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = (await req.json()) as Record<string, unknown>;
  const fields = pickClientFields(body);
  if (Object.keys(fields).length === 0) {
    return new Response("nothing to update", { status: 400 });
  }
  const { data, error } = await supabase
    .from("clients")
    .update(fields)
    .eq("id", params.id)
    .select(CLIENT_FULL_COLUMNS)
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ client: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { error } = await supabase.from("clients").delete().eq("id", params.id);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
