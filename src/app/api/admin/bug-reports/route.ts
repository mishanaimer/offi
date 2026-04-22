import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/bug-reports?id=<uuid>
 * { status?: new|in_progress|resolved|dismissed, admin_notes?: string }
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
  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!["new", "in_progress", "resolved", "dismissed"].includes(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === "resolved" || body.status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
    } else {
      patch.resolved_at = null;
    }
  }

  if (body.admin_notes !== undefined) {
    patch.admin_notes = String(body.admin_notes ?? "").slice(0, 4000);
  }

  if (!Object.keys(patch).length) {
    return Response.json({ error: "nothing to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("bug_reports").update(patch).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
