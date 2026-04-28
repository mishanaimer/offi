import JSZip from "jszip";
import type { ContractConfig, GenerateResult, ReplacementRule } from "./types";

// Преобразования для computed_fields. Порт TRANSFORMS из generator.py.
const TRANSFORMS: Record<string, (value: string) => string> = {
  strip_trailing_dot: (v) => v.replace(/\.+$/, ""),
  first_part_of_date: (v) => (v.includes(".") ? v.split(".")[0] : v),
};

function computeDerivedFields(config: ContractConfig, data: Record<string, string>): Record<string, string> {
  const enriched: Record<string, string> = { ...data };
  for (const cf of config.computed_fields ?? []) {
    const transform = TRANSFORMS[cf.transform];
    if (!transform) throw new Error(`Неизвестное преобразование: ${cf.transform}`);
    enriched[cf.key] = transform(enriched[cf.from_field] ?? "");
  }
  return enriched;
}

function renderReplacements(
  config: ContractConfig,
  data: Record<string, string>
): { rules: ReplacementRule[]; warnings: string[] } {
  const enriched = computeDerivedFields(config, data);
  const warnings: string[] = [];
  const placeholderRe = /\{\{(\w+)\}\}/g;

  const usedKeys = new Set<string>();
  for (const rule of config.replacements) {
    let mm: RegExpExecArray | null;
    placeholderRe.lastIndex = 0;
    while ((mm = placeholderRe.exec(rule.replace)) !== null) {
      usedKeys.add(mm[1]);
    }
  }

  for (const key of usedKeys) {
    const v = enriched[key];
    if (v === undefined || v === null || v === "") {
      // spec_contact_phone — традиционно опциональное
      if (key === "spec_contact_phone") continue;
      warnings.push(`Поле «${key}» пустое — в документе подставится пустая строка`);
    }
  }

  const rules: ReplacementRule[] = config.replacements.map((rule) => ({
    find: rule.find,
    replace: rule.replace.replace(placeholderRe, (_full, key: string) => String(enriched[key] ?? "")),
    count: rule.count ?? null,
  }));
  return { rules, warnings };
}

function applyReplacements(xml: string, rules: ReplacementRule[]): { xml: string; warnings: string[] } {
  const warnings: string[] = [];
  let result = xml;
  for (const rule of rules) {
    const actual = countOccurrences(result, rule.find);
    if (actual === 0) {
      warnings.push(`Не найдено в шаблоне: ${rule.find.slice(0, 80)}`);
      continue;
    }
    if (rule.count != null && actual !== rule.count) {
      warnings.push(`Ожидалось ${rule.count} вхождений, найдено ${actual}: ${rule.find.slice(0, 80)}`);
    }
    result = splitJoin(result, rule.find, rule.replace);
  }
  return { xml: result, warnings };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function splitJoin(haystack: string, needle: string, replacement: string): string {
  return haystack.split(needle).join(replacement);
}

export interface GenerateOptions {
  templateBuffer: Buffer;
  config: ContractConfig;
  data: Record<string, string>;
}

export async function generateContractDocx(opts: GenerateOptions): Promise<{
  docx: Buffer;
  warnings: string[];
  replacementsApplied: number;
}> {
  const zip = await JSZip.loadAsync(opts.templateBuffer);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("В шаблоне нет word/document.xml");

  const xmlText = await docXml.async("string");
  const { rules, warnings: preWarnings } = renderReplacements(opts.config, opts.data);
  const { xml: newXml, warnings: replaceWarnings } = applyReplacements(xmlText, rules);

  zip.file("word/document.xml", newXml);

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return {
    docx: buf,
    warnings: [...preWarnings, ...replaceWarnings],
    replacementsApplied: rules.length,
  };
}

export async function docxToHtml(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ buffer: buf });
  return value;
}

export async function generateAndPreview(opts: GenerateOptions): Promise<GenerateResult> {
  const { docx, warnings, replacementsApplied } = await generateContractDocx(opts);
  const html = await docxToHtml(docx);
  const safeName = (opts.data.client_short_name || "без_названия")
    .replace(/\s+/g, "_")
    .replace(/[«»"]/g, "");
  return {
    warnings,
    replacementsApplied,
    docxBase64: docx.toString("base64"),
    htmlPreview: html,
    suggestedName: `Договор_${safeName}.docx`,
  };
}
