// Тест TS-порта merge_runs против Python-эталона.
// Берём ОРИГИНАЛЬНЫЙ (не предобработанный) docx из contract_tool/templates_docx,
// прогоняем через TS merge-runs и проверяем, что результат канонический.
import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";

const { mergeRunsInDocumentXml } = await import("../src/lib/contract-generator/merge-runs.ts");

const original = await readFile(new URL("templates_docx/aisystems_internet.docx", import.meta.url));
const zip = await JSZip.loadAsync(original);
const xml = await zip.file("word/document.xml").async("string");

const { xml: merged, merged: count } = mergeRunsInDocumentXml(xml);

console.log("Слито runs:", count);
console.log("Размер до :", xml.length, "символов");
console.log("Размер после:", merged.length, "символов");

// Проверим, что несколько ключевых фраз стали целыми <w:t>
const phrases = [
  "ИНН 2905003266",
  "ООО «МедикоМ»",
  "Жаров В.И./",
  "г. Москва",
  "07.04.2026",
];
for (const p of phrases) {
  // ищем как полную фразу внутри <w:t...>...</w:t>
  const re = new RegExp(`<w:t[^>]*>${p.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}</w:t>`);
  console.log(`${re.test(merged) ? "OK" : "MISS"}  «${p}»`);
}
await writeFile(new URL("merged_test.xml", import.meta.url), merged);
