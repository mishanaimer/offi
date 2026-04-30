import fs from "node:fs";
import path from "node:path";

export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  order: number;
  content: string;
};

const LEGAL_DIR = path.join(process.cwd(), "src", "content", "legal");

const FILES_BY_SLUG: Record<string, string> = {
  offer: "offer.md",
  privacy: "privacy-policy.md",
  cookies: "cookie-notice.md",
  dpa: "dpa.md",
};

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body: match[2] };
}

export function loadLegalDoc(slug: string): LegalDoc | null {
  const file = FILES_BY_SLUG[slug];
  if (!file) return null;
  const fullPath = path.join(LEGAL_DIR, file);
  if (!fs.existsSync(fullPath)) return null;
  const raw = fs.readFileSync(fullPath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);
  return {
    slug,
    title: meta.title ?? slug,
    updated: meta.updated ?? "",
    order: Number(meta.order ?? 99),
    content: body,
  };
}

export function listLegalDocs(): LegalDoc[] {
  return Object.keys(FILES_BY_SLUG)
    .map((slug) => loadLegalDoc(slug))
    .filter((d): d is LegalDoc => d !== null)
    .sort((a, b) => a.order - b.order);
}
