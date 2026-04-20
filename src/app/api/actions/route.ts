import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/adapters/email";
import { sendTelegramMessage } from "@/adapters/telegram";
import { createCalendarEvent } from "@/adapters/calendar";

export const runtime = "nodejs";

type ActionBody = {
  action: string;
  params: Record<string, unknown>;
  confirmed?: boolean;          // для CONFIRM_REQUIRED должен быть true
};

const CONFIRM_REQUIRED = new Set(["send_email", "send_telegram"]);

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ActionBody;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  const companyId = profile?.company_id;
  if (!companyId) return new Response("no company", { status: 400 });

  if (CONFIRM_REQUIRED.has(body.action) && !body.confirmed) {
    return Response.json({ ok: false, needsConfirmation: true });
  }

  const service = createServiceClient();
  const { data: log } = await service
    .from("action_log")
    .insert({
      company_id: companyId,
      user_id: user.id,
      action: body.action,
      params: body.params,
      status: "pending",
    })
    .select()
    .single();

  let result: any = { ok: false, error: "unknown action" };
  try {
    switch (body.action) {
      case "send_email":
        result = await sendEmail(body.params as any);
        break;
      case "send_telegram":
        result = await sendTelegramMessage(body.params as any);
        break;
      case "create_meeting":
      case "add_to_calendar":
        result = await createCalendarEvent(body.params as any);
        break;
      case "find_client": {
        const q = String((body.params as any).query ?? "");
        const { data } = await supabase
          .from("clients")
          .select("*")
          .or(`name.ilike.%${q}%,contact.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(5);
        result = { ok: true, clients: data ?? [] };
        break;
      }
      case "generate_document": {
        const { template_id, client_id, variables } = body.params as any;
        const { data: tpl } = await supabase.from("templates").select("*").eq("id", template_id).single();
        if (!tpl) { result = { ok: false, error: "template not found" }; break; }
        const { data: client } = client_id
          ? await supabase.from("clients").select("*").eq("id", client_id).single()
          : { data: null };
        const content = render(tpl.body, client, variables ?? {});
        const { data: saved } = await service
          .from("generated_docs")
          .insert({ company_id: companyId, client_id: client_id ?? null, template_id, content })
          .select()
          .single();
        result = { ok: true, doc_id: saved?.id, content };
        break;
      }
    }
  } catch (e) {
    result = { ok: false, error: (e as Error).message };
  }

  await service.from("action_log")
    .update({ status: result?.ok ? "success" : "error", result })
    .eq("id", log!.id);

  return Response.json(result);
}

function render(body: string, client: any, variables: Record<string, unknown>) {
  let out = body;
  if (client) {
    out = out
      .replace(/\{\{client\.name\}\}/g, String(client.name ?? ""))
      .replace(/\{\{client\.contact\}\}/g, String(client.contact ?? ""))
      .replace(/\{\{client\.email\}\}/g, String(client.email ?? ""))
      .replace(/\{\{client\.phone\}\}/g, String(client.phone ?? ""));
  }
  for (const [k, v] of Object.entries(variables)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return out.replace(/\{\{date\}\}/g, new Date().toLocaleDateString("ru-RU"));
}
