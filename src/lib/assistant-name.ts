/**
 * Автогенерация имени ассистента из названия компании.
 * Правило: берём 2–4 первые буквы + мягкое окончание.
 * АйСистемс → Айли, ДентОпт → Денти, Рестораны → Ресли.
 */
const SOFT_ENDINGS = ["и", "ли", "ко", "ни", "ри", "си", "та"];
const VOWELS = new Set("аеёиоуыэюяАЕЁИОУЫЭЮЯ");

export function suggestAssistantName(companyName: string): string {
  const cleaned = companyName.trim().replace(/^(ООО|ИП|АО|ЗАО)\s+["«]?/i, "").replace(/["»]/g, "");
  if (!cleaned) return "Оффи";

  const firstWord = cleaned.split(/\s+/)[0];
  const base = firstWord.slice(0, 3);

  // выбрать окончание, которое не заканчивается одинаковой буквой
  const lastChar = base[base.length - 1]?.toLowerCase() ?? "";
  const ending = SOFT_ENDINGS.find((e) => !e.startsWith(lastChar)) ?? "и";

  let name = base + ending;

  // если последняя буква базы — гласная, уберём её, чтобы звучало естественнее
  if (VOWELS.has(base[base.length - 1] ?? "")) {
    name = base.slice(0, -1) + ending;
  }

  return capitalize(name);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export const DEFAULT_ASSISTANT_NAME = "Оффи";
