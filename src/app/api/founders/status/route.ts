import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // обновляем раз в минуту, чтобы не дёргать БД на каждом visit лендинга

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("founders_status");

  if (error) {
    return Response.json({ used: 0, total: 50, remaining: 50, error: error.message }, { status: 200 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return Response.json({
    used: row?.used ?? 0,
    total: row?.total ?? 50,
    remaining: row?.remaining ?? 50,
  });
}
