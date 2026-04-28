// Реестр шаблонов договоров. Сейчас все шаблоны — пользовательские:
// компания загружает свой .docx, ИИ делает из него заполняемый шаблон,
// шаблон сохраняется в БД (`contract_templates`) и Storage (`contract-templates`).
import type { ContractConfig, ContractTemplateMeta } from "./types";
import { createServiceClient } from "@/lib/supabase/server";

export const STORAGE_BUCKET = "contract-templates";

interface DbTemplateRow {
  id: string;
  name: string;
  description: string | null;
  storage_path: string;
  fields: any;
  replacements: any;
  computed_fields: any;
  warnings: any;
  created_at: string;
}

export async function listCompanyTemplates(companyId: string): Promise<ContractTemplateMeta[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("contract_templates")
    .select("id, name, description, warnings, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    canDelete: true,
    warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
    createdAt: r.created_at as string,
  }));
}

export interface ResolvedTemplate {
  meta: ContractTemplateMeta;
  config: ContractConfig;
  templateBuffer: Buffer;
}

export async function resolveTemplate(
  id: string,
  companyId: string | null
): Promise<ResolvedTemplate> {
  if (!companyId) throw new Error("Не определена компания пользователя");

  const service = createServiceClient();
  const { data: row, error } = await service
    .from("contract_templates")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (error || !row) throw new Error("Шаблон не найден");

  const t = row as DbTemplateRow;
  const config: ContractConfig = {
    name: t.name,
    description: t.description ?? "",
    docx_file: t.storage_path,
    fields: Array.isArray(t.fields) ? t.fields : [],
    replacements: Array.isArray(t.replacements) ? t.replacements : [],
    computed_fields: Array.isArray(t.computed_fields) ? t.computed_fields : [],
  };

  const { data: blob, error: dlErr } = await service.storage
    .from(STORAGE_BUCKET)
    .download(t.storage_path);
  if (dlErr || !blob) throw new Error(`Не удалось загрузить файл шаблона: ${dlErr?.message}`);
  const arr = await blob.arrayBuffer();
  const templateBuffer = Buffer.from(arr);

  return {
    meta: {
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      canDelete: true,
      warnings: Array.isArray(t.warnings) ? (t.warnings as string[]) : [],
      createdAt: t.created_at,
    },
    config,
    templateBuffer,
  };
}

export async function deleteCompanyTemplate(id: string, companyId: string): Promise<void> {
  const service = createServiceClient();
  const { data: row } = await service
    .from("contract_templates")
    .select("storage_path")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (row?.storage_path) {
    await service.storage.from(STORAGE_BUCKET).remove([row.storage_path]);
  }
  await service.from("contract_templates").delete().eq("id", id).eq("company_id", companyId);
}

export interface CreateTemplateInput {
  companyId: string;
  userId: string | null;
  name: string;
  description: string;
  sourceFilename: string;
  fields: any[];
  replacements: any[];
  computed_fields: any[];
  warnings: string[];
  docxBuffer: Buffer;
}

/** Идемпотентно гарантирует существование bucket. Если permissions
 *  не позволяют — не падает, просто оставляет ошибку из upload расти. */
async function ensureBucket(service: ReturnType<typeof createServiceClient>): Promise<void> {
  try {
    const { data } = await service.storage.getBucket(STORAGE_BUCKET);
    if (data) return;
  } catch {}
  try {
    await service.storage.createBucket(STORAGE_BUCKET, { public: false });
  } catch {
    // bucket мог быть создан параллельным запросом — это нормально
  }
}

export async function createCompanyTemplate(input: CreateTemplateInput): Promise<{ id: string; storagePath: string }> {
  const service = createServiceClient();

  await ensureBucket(service);

  const { data: row, error: insertErr } = await service
    .from("contract_templates")
    .insert({
      company_id: input.companyId,
      created_by: input.userId,
      name: input.name,
      description: input.description,
      source_filename: input.sourceFilename,
      storage_path: "tbd", // обновим после загрузки
      fields: input.fields,
      replacements: input.replacements,
      computed_fields: input.computed_fields,
      warnings: input.warnings,
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    const msg = insertErr?.message ?? "Не удалось создать шаблон";
    if (msg.includes("contract_templates")) {
      throw new Error(
        "Таблица contract_templates ещё не создана. Примени миграцию supabase/migrations/0010_contract_templates.sql в SQL Editor Supabase."
      );
    }
    throw new Error(msg);
  }

  const storagePath = `${input.companyId}/${row.id}.docx`;
  const { error: upErr } = await service.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.docxBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (upErr) {
    await service.from("contract_templates").delete().eq("id", row.id);
    throw new Error(`Не удалось сохранить файл: ${upErr.message}`);
  }

  await service.from("contract_templates").update({ storage_path: storagePath }).eq("id", row.id);

  return { id: row.id, storagePath };
}

export async function getTemplateDetails(id: string, companyId: string | null): Promise<{
  meta: ContractTemplateMeta;
  fields: any[];
}> {
  const r = await resolveTemplate(id, companyId);
  return { meta: r.meta, fields: r.config.fields };
}
