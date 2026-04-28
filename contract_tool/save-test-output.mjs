import { readFile, writeFile, mkdir } from "node:fs/promises";

const { generateContractDocx } = await import("../src/lib/contract-generator/generator.ts");
const config = JSON.parse(
  await readFile(new URL("../src/lib/contract-generator/templates/aisystems_internet.json", import.meta.url), "utf8")
);
const buf = await readFile(
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
  client_legal_address: "199178, г. Санкт-Петербург, пр. Средний В.О., дом 65",
  client_actual_address: "197375, г. Санкт-Петербург, ул. Маршала Новикова, д. 28",
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
  service_address: "Аптека на трамвайном (А-235/29). Контактное лицо: Королева О.В.",
  service_address_short: "Аптека на трамвайном (А-235/29)",
};

const { docx, warnings, replacementsApplied } = await generateContractDocx({
  templateBuffer: buf,
  config,
  data,
});
await mkdir(new URL("./output/", import.meta.url), { recursive: true });
await writeFile(new URL("./output/edifarm_ts.docx", import.meta.url), docx);
console.log("saved", docx.length, "bytes, rules:", replacementsApplied, "warnings:", warnings.length);
