export type FieldType = "text" | "textarea";

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: FieldType;
  hint?: string;
  required?: boolean;
}

export interface ReplacementRule {
  find: string;
  replace: string;
  count?: number | null;
  comment?: string;
}

export interface ComputedField {
  key: string;
  from_field: string;
  transform: string;
}

export interface ContractConfig {
  name: string;
  description: string;
  docx_file: string;
  fields: FieldDef[];
  replacements: ReplacementRule[];
  computed_fields?: ComputedField[];
}

export interface ContractTemplateMeta {
  id: string;
  name: string;
  description: string;
  canDelete?: boolean;
  warnings?: string[];
  createdAt?: string;
}

export interface GenerateResult {
  warnings: string[];
  replacementsApplied: number;
  docxBase64: string;
  htmlPreview: string;
  suggestedName: string;
}
