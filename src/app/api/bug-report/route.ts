import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  subject?: string | null;
  message: string;
  severity?: "low" | "normal" | "high" | "critical";
  pageUrl?: string;
  details?: Record<string, unknown>;
};

const ALLOWED_SEVERITY = new Set(["low", "normal", "high", "critical"]);

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return new Response("empty message", { status: 400 });
  if (message.length > 4000) return new Response("message too long", { status: 400 });

  const severity = ALLOWED_SEVERITY.has(body.severity ?? "")
    ? (body.severity as Body["severity"])
    : "normal";

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let companyId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    companyId = profile?.company_id ?? null;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("bug_reports")
    .insert({
      company_id: companyId,
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      page_url: body.pageUrl?.slice(0, 1000) ?? null,
      subject: body.subject?.toString().slice(0, 200) ?? null,
      message,
      severity,
      details: { ...(body.details ?? {}), ip },
    })
    .select("id")
    .single();

  if (error) {
    console.error("bug-report insert failed:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, id: data.id });
}
