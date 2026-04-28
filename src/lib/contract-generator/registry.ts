import path from "path";
import fs from "fs/promises";
import type { ContractConfig, ContractTemplateMeta } from "./types";

const TEMPLATES_DIR = path.join(process.cwd(), "src", "lib", "contract-generator", "templates");

const TEMPLATE_IDS = ["aisystems_internet"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export async function loadConfig(id: string): Promise<ContractConfig> {
  if (!TEMPLATE_IDS.includes(id as TemplateId)) {
    throw new Error(`Шаблон не найден: ${id}`);
  }
  const raw = await fs.readFile(path.join(TEMPLATES_DIR, `${id}.json`), "utf-8");
  return JSON.parse(raw) as ContractConfig;
}

export async function loadTemplateBuffer(config: ContractConfig): Promise<Buffer> {
  return fs.readFile(path.join(TEMPLATES_DIR, config.docx_file));
}

export async function listTemplates(): Promise<ContractTemplateMeta[]> {
  const out: ContractTemplateMeta[] = [];
  for (const id of TEMPLATE_IDS) {
    const cfg = await loadConfig(id);
    out.push({ id, name: cfg.name, description: cfg.description });
  }
  return out;
}
