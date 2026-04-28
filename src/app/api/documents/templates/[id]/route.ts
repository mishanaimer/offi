import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteCompanyTemplate, getTemplateDetails } from "@/lib/contract-generator/registry";

export const runtime = "nodejs";

async function getCompanyId(): Promise<{ companyId: string | null; userId: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { companyId: null, userId: null };
  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  return { companyId: (profile?.company_id as string) ?? null, userId: user.id };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { companyId } = await getCompanyId();
  try {
    const { meta, fields } = await getTemplateDetails(params.id, companyId);
    return Response.json({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      canDelete: meta.canDelete,
      fields,
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { companyId } = await getCompanyId();
  if (!companyId) return new Response("unauthorized", { status: 401 });

  const body = (await req.json()) as { name?: string; description?: string; fields?: any[] };
  const update: Record<string, any> = {};
  if (typeof body.name === "string") update.name = body.name;
  if (typeof body.description === "string") update.description = body.description;
  if (Array.isArray(body.fields)) update.fields = body.fields;
  if (Object.keys(update).length === 0) return new Response("no changes", { status: 400 });
  update.updated_at = new Date().toISOString();

  const service = createServiceClient();
  const { error } = await service
    .from("contract_templates")
    .update(update)
    .eq("id", params.id)
    .eq("company_id", companyId);
  if (error) return new Response(error.message, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { companyId } = await getCompanyId();
  if (!companyId) return new Response("unauthorized", { status: 401 });
  try {
    await deleteCompanyTemplate(params.id, companyId);
    return Response.json({ ok: true });
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }
}
