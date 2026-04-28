// Smoke-test для портированного TS-генератора. Имитирует test_core.py.
// Запуск: npx tsx contract_tool/smoke-test.mjs
import { readFile } from "node:fs/promises";

const { generateContractDocx } = await import("../src/lib/contract-generator/generator.ts");
const { parseRequisites } = await import("../src/lib/contract-generator/parse-requisites.ts");

const config = JSON.parse(
  await readFile(new URL("../src/lib/contract-generator/templates/aisystems_internet.json", import.meta.url), "utf8")
);
const templateBuffer = await readFile(
  new URL("../src/lib/contract-generator/templates/aisystems_internet.docx", import.meta.url)
);

const data = {
  contract_number: "28/0426",
  contract_day: "28",
  contract_month: "апреля",
  contract_year: "2026",
  act_date_short: "28.04.2026",
  act_day_padded: "28",
  act_city: "Санкт-Петербург",
  service_start_date: "06.05.2026",

  client_full_name: "Общество с ограниченной ответственностью «ЭДИФАРМ»",
  client_short_name: "ООО «ЭДИФАРМ»",
  client_signatory_clause:
    "в лице Генерального директора Антоновой Светланы Александровны, действующей на основании Устава",
  client_signatory_short: "Антонова С.А.",
  client_signatory_title: "Генеральный директор",

  client_legal_address:
    "199178, г. Санкт-Петербург, пр. Средний В.О., дом 65, лит. А, офис Э/ПОМ/Ч.П. 1/2-Н/2",
  client_actual_address:
    "197375, г. Санкт-Петербург, ул. Маршала Новикова, д. 28, корп. 2, лит. А",

  client_inn: "7801121793",
  client_kpp: "780101001",
  client_ogrn: "1037800002426",
  client_account: "40702810755070001360",
  client_bank: "ПАО Сбербанк",
  client_corr_account: "30101810500000000653",
  client_bik: "044030653",
  client_email: "office@aloea.ru",

  spec_contact_name: "Петр",
  spec_contact_phone: "",
  spec_contact_email: "Gnilobokov.petr@bsspharm.ru",

  service_address: "Аптека на трамвайном (А-235/29). Контактное лицо: Королева Ольга Викторовна",
  service_address_short: "Аптека на трамвайном (А-235/29)",
};

const { docx, warnings, replacementsApplied } = await generateContractDocx({
  templateBuffer,
  config,
  data,
});

console.log("Применено правил:", replacementsApplied);
console.log("Размер docx:", docx.length, "байт");
console.log("Предупреждений:", warnings.length);
for (const w of warnings) console.log("  ⚠", w);

const cardText = `
ООО «АЛОЭ»
Общество с ограниченной ответственностью «АЛОЭ»
ИНН 7814293260, КПП 781401001, ОГРН 1157847365015
р/с 40702810055070003990 в ПАО Сбербанк
к/с 30101810500000000653, БИК 044030653
Юридический адрес: 197375, г. Санкт-Петербург, ул. Маршала Новикова, д. 28, корп. 2
Фактический адрес: 199178, г. Санкт-Петербург, пр. Средний В.О., дом 65
E-mail: office@aloea.ru
В лице Генерального директора Антоновой Светланы Александровны
`;
console.log("\n=== parseRequisites smoke ===");
console.log(JSON.stringify(parseRequisites(cardText), null, 2));
