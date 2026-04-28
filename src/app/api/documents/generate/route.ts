import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveTemplate } from "@/lib/contract-generator/registry";
import { generateAndPreview } from "@/lib/contract-generator/generator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { template_id?: string; data?: Record<string, string> };
  const { template_id, data } = body;
  if (!template_id || !data) {
    return new Response("template_id and data required", { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let companyId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();
    companyId = (profile?.company_id as string) ?? null;
  }

  try {
    const { config, templateBuffer } = await resolveTemplate(template_id, companyId);
    const result = await generateAndPreview({ templateBuffer, config, data });
    return Response.json(result);
  } catch (err) {
    return new Response((err as Error).message, { status: 500 });
  }
}
