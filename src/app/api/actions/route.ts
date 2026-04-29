import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/adapters/email";
import { sendTelegramMessage } from "@/adapters/telegram";
import { createCalendarEvent } from "@/adapters/calendar";
import { embed } from "@/lib/embeddings";
import { resolveTemplate, listCompanyTemplates, STORAGE_BUCKET as TPL_BUCKET } from "@/lib/contract-generator/registry";
import { generateContractDocx, docxToHtml } from "@/lib/contract-generator/generator";
import {
  CLIENT_FULL_COLUMNS,
  CLIENT_LIST_COLUMNS,
  clientToContractData,
  loadContracts,
  pickClientFields,
  type ClientFull,
} from "@/lib/clients";
import { renderTextTemplate } from "@/lib/template-render";

export const runtime = "nodejs";
export const maxDuration = 60;

type ActionBody = {
  action: string;
  params: Record<string, unknown>;
  confirmed?: boolean;
};

const CONFIRM_REQUIRED = new Set(["send_email", "send_telegram"]);

const CONTRACTS_BUCKET = "generated-contracts";

async function ensureBucket(service: ReturnType<typeof createServiceClient>, bucket: string) {
  try {
    const { data } = await service.storage.getBucket(bucket);
    if (data) return;
  } catch {}
  try {
    await service.storage.createBucket(bucket, { public: false });
  } catch {}
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ActionBody;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id as string | undefined;
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
        const q = String((body.params as any).query ?? "").trim();
        const { data } = await supabase.rpc("search_clients", {
          p_company_id: companyId,
          p_query: q || null,
          p_limit: 8,
        });
        const clients = data ?? [];
        result = {
          ok: true,
          count: clients.length,
          clients,
          hint:
            clients.length === 0
              ? "Не нашёл клиента. Попроси пользователя уточнить или предложи создать."
              : `Найдено ${clients.length}. Передай client_id в get_client / ai_create_contract.`,
        };
        break;
      }

      case "get_client": {
        const clientId = String((body.params as any).client_id ?? "");
        if (!clientId) {
          result = { ok: false, error: "client_id required" };
          break;
        }
        const [{ data: client }, { data: notes }, { data: files }, { data: memories }] =
          await Promise.all([
            supabase.from("clients").select(CLIENT_FULL_COLUMNS).eq("id", clientId).single(),
            supabase
              .from("client_notes")
              .select("id, content, source, created_at")
              .eq("client_id", clientId)
              .order("created_at", { ascending: false })
              .limit(20),
            supabase
              .from("client_files")
              .select("id, name, kind, created_at")
              .eq("client_id", clientId)
              .order("created_at", { ascending: false })
              .limit(20),
            supabase
              .from("memories")
              .select("id, content, kind, created_at")
              .eq("client_id", clientId)
              .order("created_at", { ascending: false })
              .limit(30),
          ]);
        const contracts = await loadContracts(service, companyId, { clientId, limit: 20 });
        result = client
          ? { ok: true, client, notes: notes ?? [], files: files ?? [], memories: memories ?? [], contracts }
          : { ok: false, error: "client not found" };
        break;
      }

      case "list_clients": {
        const status = (body.params as any).status as string | undefined;
        const limit = Math.min(Number((body.params as any).limit ?? 20), 50);
        let q = supabase
          .from("clients")
          .select(CLIENT_LIST_COLUMNS)
          .order("last_contact_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status) q = q.eq("status", status);
        const { data } = await q;
        result = { ok: true, count: data?.length ?? 0, clients: data ?? [] };
        break;
      }

      case "update_client": {
        const params = body.params as any;
        const id = String(params.client_id ?? "");
        if (!id) {
          result = { ok: false, error: "client_id required" };
          break;
        }
        const fields = pickClientFields(params);
        delete (fields as any).client_id;
        if (Object.keys(fields).length === 0) {
          result = { ok: false, error: "no fields to update" };
          break;
        }
        const { data, error } = await supabase
          .from("clients")
          .update(fields)
          .eq("id", id)
          .select(CLIENT_LIST_COLUMNS)
          .single();
        result = error ? { ok: false, error: error.message } : { ok: true, client: data };
        break;
      }

      case "save_client_note": {
        const params = body.params as any;
        const id = String(params.client_id ?? "");
        const content = String(params.content ?? "").trim();
        if (!id || !content) {
          result = { ok: false, error: "client_id and content required" };
          break;
        }
        // обновим last_contact_at
        await supabase.from("clients").update({ last_contact_at: new Date().toISOString() }).eq("id", id);
        const { data, error } = await supabase
          .from("client_notes")
          .insert({
            client_id: id,
            user_id: user.id,
            content: content.slice(0, 4000),
            source: params.source ?? "chat",
          })
          .select("id, content, source, created_at")
          .single();
        result = error ? { ok: false, error: error.message } : { ok: true, note: data };
        break;
      }

      case "remember_fact": {
        const content = String((body.params as any).content ?? "").trim();
        const kind = ["fact", "preference", "agreement", "rule"].includes(
          String((body.params as any).kind)
        )
          ? String((body.params as any).kind)
          : "fact";
        const clientId = (body.params as any).client_id
          ? String((body.params as any).client_id)
          : null;
        if (!content) {
          result = { ok: false, error: "empty fact" };
          break;
        }
        let vec: number[] | null = null;
        try {
          vec = await embed(content);
        } catch {}
        const { data: mem, error: mErr } = await service
          .from("memories")
          .insert({
            company_id: companyId,
            content: content.slice(0, 1000),
            kind,
            source: "chat",
            client_id: clientId,
            created_by: user.id,
            embedding: (vec ?? null) as any,
          })
          .select("id, content, kind, client_id")
          .single();
        result = mErr ? { ok: false, error: mErr.message } : { ok: true, memory: mem };
        break;
      }

      case "list_contract_templates": {
        const templates = await listCompanyTemplates(companyId);
        result = {
          ok: true,
          count: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
          })),
        };
        break;
      }

      case "list_contracts": {
        const params = body.params as any;
        const clientId = params.client_id ? String(params.client_id) : null;
        const limit = Math.min(Number(params.limit ?? 20), 50);
        const all = await loadContracts(service, companyId, { clientId, limit });
        const q = (params.query as string | undefined)?.toLowerCase().trim();
        const filtered = q
          ? all.filter((c) =>
              [c.name, c.template_name].some((v) => v && String(v).toLowerCase().includes(q))
            )
          : all;
        result = { ok: true, count: filtered.length, contracts: filtered };
        break;
      }

      case "ai_create_contract": {
        const params = body.params as any;
        const clientId = String(params.client_id ?? "");
        if (!clientId) {
          result = { ok: false, error: "client_id required" };
          break;
        }
        const { data: clientRow } = await supabase
          .from("clients")
          .select(CLIENT_FULL_COLUMNS)
          .eq("id", clientId)
          .single();
        if (!clientRow) {
          result = { ok: false, error: "client not found" };
          break;
        }
        const client = clientRow as ClientFull;

        // template selection
        let templateId = (params.template_id as string | undefined) ?? null;
        if (!templateId) {
          const tpls = await listCompanyTemplates(companyId);
          if (tpls.length === 0) {
            result = {
              ok: false,
              error:
                "В компании нет шаблонов договоров. Загрузи .docx в раздел Документы → Договоры.",
            };
            break;
          }
          // если не указан — берём первый (самый свежий)
          templateId = tpls[0].id;
        }

        const resolved = await resolveTemplate(templateId, companyId);
        const fromClient = clientToContractData(client);
        const extraVars = (params.variables ?? {}) as Record<string, string>;
        const data: Record<string, string> = { ...fromClient };
        for (const [k, v] of Object.entries(extraVars)) {
          if (typeof v === "string" || typeof v === "number") data[k] = String(v);
        }
        // дефолт: дата
        const todayStr = new Date().toLocaleDateString("ru-RU");
        if (!data.contract_date) data.contract_date = todayStr;

        const { docx, warnings, replacementsApplied } = await generateContractDocx({
          templateBuffer: resolved.templateBuffer,
          config: resolved.config,
          data,
        });

        const safeName = (client.short_name || client.name || "клиент")
          .replace(/\s+/g, "_")
          .replace(/[«»"\\\\\/]+/g, "");
        const fileName = (params.name as string | undefined) || `Договор_${safeName}_${Date.now()}.docx`;
        const storagePath = `${companyId}/${clientId}/${crypto.randomUUID()}.docx`;

        await ensureBucket(service, CONTRACTS_BUCKET);
        const { error: upErr } = await service.storage
          .from(CONTRACTS_BUCKET)
          .upload(storagePath, docx, {
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: false,
          });
        if (upErr) {
          result = { ok: false, error: `upload failed: ${upErr.message}` };
          break;
        }
        const { data: signed } = await service.storage
          .from(CONTRACTS_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        const downloadUrl = signed?.signedUrl ?? null;

        const { data: saved } = await service
          .from("generated_contracts")
          .insert({
            company_id: companyId,
            template_id: templateId,
            client_id: clientId,
            data,
            storage_path: storagePath,
            download_url: downloadUrl,
            warnings,
            name: fileName,
            created_by: user.id,
          })
          .select("id")
          .single();

        // обновим last_contact_at + добавим заметку, чтобы видно было в истории клиента
        await supabase.from("clients").update({ last_contact_at: new Date().toISOString() }).eq("id", clientId);
        await supabase.from("client_notes").insert({
          client_id: clientId,
          user_id: user.id,
          content: `Сгенерирован договор «${fileName}» по шаблону «${resolved.meta.name}»`,
          source: "chat",
        });

        let htmlPreview: string | null = null;
        try {
          htmlPreview = await docxToHtml(docx);
        } catch {}

        result = {
          ok: true,
          contract_id: saved?.id ?? null,
          name: fileName,
          download_url: downloadUrl,
          template_name: resolved.meta.name,
          replacements_applied: replacementsApplied,
          warnings,
          html_preview: htmlPreview ? htmlPreview.slice(0, 8000) : null,
        };
        break;
      }

      case "generate_document": {
        const { template_id, client_id, variables } = body.params as any;
        const { data: tpl } = await supabase.from("templates").select("*").eq("id", template_id).single();
        if (!tpl) {
          result = { ok: false, error: "template not found" };
          break;
        }
        const { data: client } = client_id
          ? await supabase.from("clients").select(CLIENT_FULL_COLUMNS).eq("id", client_id).single()
          : { data: null };
        const { data: profileRow } = await supabase
          .from("users")
          .select("full_name, email, company:companies(name, assistant_name)")
          .eq("id", user.id)
          .single();
        const meCompany = (profileRow as any)?.company ?? null;
        const content = renderTextTemplate(tpl.body, {
          client: client ?? null,
          user: profileRow
            ? { full_name: (profileRow as any).full_name, email: (profileRow as any).email }
            : null,
          company: meCompany,
          extra: (variables ?? {}) as Record<string, unknown>,
        });
        const { data: saved } = await service
          .from("generated_docs")
          .insert({ company_id: companyId, client_id: client_id ?? null, template_id, content })
          .select()
          .single();
        result = { ok: true, doc_id: saved?.id, content };
        break;
      }

      case "list_text_templates": {
        const { data, error } = await supabase
          .from("templates")
          .select("id, name, body, updated_at, created_at")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(50);
        result = error
          ? { ok: false, error: error.message }
          : {
              ok: true,
              count: data?.length ?? 0,
              templates: (data ?? []).map((t: any) => ({
                id: t.id,
                name: t.name,
                preview: String(t.body ?? "").slice(0, 200),
                updated_at: t.updated_at ?? t.created_at,
              })),
            };
        break;
      }

      case "create_text_template": {
        const params = body.params as any;
        const name = String(params.name ?? "").trim();
        const tplBody = String(params.body ?? "");
        if (!name || !tplBody.trim()) {
          result = { ok: false, error: "name and body required" };
          break;
        }
        const { data, error } = await supabase
          .from("templates")
          .insert({ name, body: tplBody })
          .select("id, name, body, created_at, updated_at")
          .single();
        result = error ? { ok: false, error: error.message } : { ok: true, template: data };
        break;
      }

      case "update_text_template": {
        const params = body.params as any;
        const id = String(params.template_id ?? params.id ?? "");
        if (!id) {
          result = { ok: false, error: "template_id required" };
          break;
        }
        const update: Record<string, unknown> = {};
        if (typeof params.name === "string" && params.name.trim()) update.name = params.name.trim();
        if (typeof params.body === "string") update.body = params.body;
        if (Object.keys(update).length === 0) {
          result = { ok: false, error: "nothing to update" };
          break;
        }
        const { data, error } = await supabase
          .from("templates")
          .update(update)
          .eq("id", id)
          .select("id, name, body, created_at, updated_at")
          .single();
        result = error ? { ok: false, error: error.message } : { ok: true, template: data };
        break;
      }

      case "delete_text_template": {
        const id = String((body.params as any).template_id ?? (body.params as any).id ?? "");
        if (!id) {
          result = { ok: false, error: "template_id required" };
          break;
        }
        const { error } = await supabase.from("templates").delete().eq("id", id);
        result = error ? { ok: false, error: error.message } : { ok: true };
        break;
      }

      case "create_client": {
        const params = body.params as any;
        const fields = pickClientFields(params);
        const name = (fields.name as string | undefined)?.trim();
        if (!name) {
          result = { ok: false, error: "name required" };
          break;
        }
        const insert: Record<string, unknown> = {
          ...fields,
          created_by: user.id,
          owner_id: fields.owner_id ?? user.id,
          last_contact_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from("clients")
          .insert(insert)
          .select(CLIENT_FULL_COLUMNS)
          .single();
        if (error) {
          result = { ok: false, error: error.message };
          break;
        }
        // Сразу заметка о создании, чтобы сохранилась история
        await supabase.from("client_notes").insert({
          client_id: (data as any).id,
          user_id: user.id,
          content: "Карточка создана через AI-ассистента",
          source: "chat",
        });
        result = { ok: true, client: data };
        break;
      }
    }
  } catch (e) {
    result = { ok: false, error: (e as Error).message };
  }

  await service
    .from("action_log")
    .update({ status: result?.ok ? "success" : "error", result })
    .eq("id", log!.id);

  return Response.json(result);
}
