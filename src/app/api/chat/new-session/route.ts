import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — создать новый AI-канал и вернуть его id. */
export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id;
  if (!companyId) return new Response("no company", { status: 400 });

  const service = createServiceClient();
  const { data: channel, error } = await service
    .from("channels")
    .insert({
      company_id: companyId,
      name: `Диалог от ${new Date().toLocaleDateString("ru-RU")}`,
      type: "ai",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, channelId: channel.id });
}
