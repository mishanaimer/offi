import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/lib/admin";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/plan-requests?id=<uuid>
 * { status: contacted|activated|cancelled, activate_plan?: string }
 * При status=activated также меняет companies.plan.
 */
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSuperadmin(user.email)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (!["contacted", "activated", "cancelled"].includes(status)) {
    return Response.json({ error: "invalid status" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: request, error: loadErr } = await service
    .from("plan_requests")
    .select("id, company_id, plan")
    .eq("id", id)
    .single();
  if (loadErr || !request) return Response.json({ error: "not found" }, { status: 404 });

  const { error } = await service.from("plan_requests").update({ status }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (status === "activated") {
    const targetPlan = body.activate_plan ?? request.plan;
    if (Object.keys(PLANS).includes(targetPlan)) {
      await service.from("companies").update({ plan: targetPlan }).eq("id", request.company_id);
    }
  }

  return Response.json({ ok: true });
}
