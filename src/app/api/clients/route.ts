import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_LIST_COLUMNS, pickClientFields } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);

  let query = supabase
    .from("clients")
    .select(CLIENT_LIST_COLUMNS)
    .order("last_contact_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      [
        `name.ilike.${like}`,
        `short_name.ilike.${like}`,
        `legal_name.ilike.${like}`,
        `contact.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `inn.ilike.${like}`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ clients: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const fields = pickClientFields(body);
  const name = (fields.name as string | undefined)?.trim();
  if (!name) return new Response("name required", { status: 400 });

  const insert: Record<string, unknown> = {
    ...fields,
    created_by: user.id,
  };
  // если owner не указан — назначаем создателя владельцем
  if (!insert.owner_id) insert.owner_id = user.id;

  const { data, error } = await supabase
    .from("clients")
    .insert(insert)
    .select(CLIENT_LIST_COLUMNS)
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ client: data });
}
