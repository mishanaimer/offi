import path from "path";
import fs from "fs/promises";
import type { ContractConfig, ContractTemplateMeta } from "./types";
import { createServiceClient } from "@/lib/supabase/server";

// === Системные (bundled) шаблоны ===
//
// Лежат в репо, видны всем компаниям, удалить нельзя. Сейчас один — Айсистемс.
// Добавить новый: положить .docx + .json в templates/, добавить id в SYSTEM_IDS.

const TEMPLATES_DIR = path.join(process.cwd(), "src", "lib", "contract-generator", "templates");
const SYSTEM_IDS = ["aisystems_internet"] as const;

export const SYSTEM_PREFIX = "system:";

function isSystemId(id: string): boolean {
  return id.startsWith(SYSTEM_PREFIX);
}

function bareSystemId(id: string): string {
  return id.startsWith(SYSTEM_PREFIX) ? id.slice(SYSTEM_PREFIX.length) : id;
}

async function loadSystemConfig(bareId: string): Promise<ContractConfig> {
  const raw = await fs.readFile(path.join(TEMPLATES_DIR, `${bareId}.json`), "utf-8");
  return JSON.parse(raw) as ContractConfig;
}

async function loadSystemTemplateBuffer(cfg: ContractConfig): Promise<Buffer> {
  return fs.readFile(path.join(TEMPLATES_DIR, cfg.docx_file));
}

export async function listSystemTemplates(): Promise<ContractTemplateMeta[]> {
  const out: ContractTemplateMeta[] = [];
  for (const id of SYSTEM_IDS) {
    try {
      const cfg = await loadSystemConfig(id);
      out.push({
        id: SYSTEM_PREFIX + id,
        name: cfg.name,
        description: cfg.description,
        source: "system",
        canDelete: false,
      });
    } catch {
      // если файл-конфиг битый/отсутствует — просто пропускаем
    }
  }
  return out;
}

// === Кастомные (БД + Storage) шаблоны ===

const STORAGE_BUCKET = "contract-templates";

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
    source: "custom" as const,
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
  if (isSystemId(id)) {
    const bare = bareSystemId(id);
    if (!SYSTEM_IDS.includes(bare as any)) {
      throw new Error(`Системный шаблон не найден: ${bare}`);
    }
    const config = await loadSystemConfig(bare);
    const templateBuffer = await loadSystemTemplateBuffer(config);
    return {
      meta: {
        id,
        name: config.name,
        description: config.description,
        source: "system",
        canDelete: false,
      },
      config,
      templateBuffer,
    };
  }
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
      source: "custom",
      canDelete: true,
      warnings: Array.isArray(t.warnings) ? (t.warnings as string[]) : [],
      createdAt: t.created_at,
    },
    config,
    templateBuffer,
  };
}

export async function deleteCompanyTemplate(id: string, companyId: string): Promise<void> {
  if (isSystemId(id)) throw new Error("Системные шаблоны нельзя удалить");
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

export async function createCompanyTemplate(input: CreateTemplateInput): Promise<{ id: string; storagePath: string }> {
  const service = createServiceClient();

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
  if (insertErr || !row) throw new Error(insertErr?.message ?? "Не удалось создать шаблон");

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
