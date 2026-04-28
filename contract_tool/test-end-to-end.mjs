// E2E: оригинальный шаблон → TS merge-runs → существующий config → generate
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const { mergeRunsInDocumentXml } = await import("../src/lib/contract-generator/merge-runs.ts");
const { generateContractDocx } = await import("../src/lib/contract-generator/generator.ts");

// Берём ОРИГИНАЛЬНЫЙ шаблон (тот, что в contract_tool/templates_docx)
// и прогоняем его через наш TS-pipeline (без Python-предобработки).
const originalDocx = await readFile(
  new URL("templates_docx/aisystems_internet.docx", import.meta.url)
);

// 1. merge-runs
const zip = await JSZip.loadAsync(originalDocx);
const xml = await zip.file("word/document.xml").async("string");
const { xml: merged, merged: mergedCount } = mergeRunsInDocumentXml(xml);
zip.file("word/document.xml", merged);
const mergedBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
console.log("merge-runs: слито", mergedCount);

// 2. existing config + test data
const config = JSON.parse(
  await readFile(
    new URL("../src/lib/contract-generator/templates/aisystems_internet.json", import.meta.url),
    "utf8"
  )
);

const data = {
  contract_number: "28/0426", contract_day: "28", contract_month: "апреля", contract_year: "2026",
  act_date_short: "28.04.2026", act_day_padded: "28", act_city: "Санкт-Петербург", service_start_date: "06.05.2026",
  client_full_name: "Общество с ограниченной ответственностью «ЭДИФАРМ»",
  client_short_name: "ООО «ЭДИФАРМ»",
  client_signatory_clause: "в лице Генерального директора Антоновой Светланы Александровны, действующей на основании Устава",
  client_signatory_short: "Антонова С.А.", client_signatory_title: "Генеральный директор",
  client_legal_address: "199178, г. Санкт-Петербург", client_actual_address: "197375, г. Санкт-Петербург",
  client_inn: "7801121793", client_kpp: "780101001", client_ogrn: "1037800002426",
  client_account: "40702810755070001360", client_bank: "ПАО Сбербанк",
  client_corr_account: "30101810500000000653", client_bik: "044030653", client_email: "office@aloea.ru",
  spec_contact_name: "Петр", spec_contact_phone: "", spec_contact_email: "p@x.ru",
  service_address: "Аптека на трамвайном", service_address_short: "Аптека",
};

const { docx, warnings, replacementsApplied } = await generateContractDocx({
  templateBuffer: mergedBuffer,
  config,
  data,
});
console.log("Применено правил:", replacementsApplied);
console.log("Размер docx:", docx.length);
console.log("Предупреждений:", warnings.length);
for (const w of warnings) console.log("  ⚠", w);
