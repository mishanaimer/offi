// Эвристики склонения ФИО — порт generator.py из contract_tool.
// Покрывают типичные русские ФИО (на -ов/-ев/-ин, -ова/-ева, -ский, -ой, -ий
// и базовые имена/отчества). Сложные/иностранные случаи лучше отдавать в LLM.

export function isFemalePatronymic(patronymic: string): boolean {
  return /(?:вна|чна|шна)$/.test(patronymic);
}

export function toNominative(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length !== 3) return fullName;
  const [surname, name, patronymic] = parts;

  const toNom = (word: string) => {
    if (word.endsWith("ой")) return word.slice(0, -2) + "а";
    if (word.endsWith("ы")) return word.slice(0, -1) + "а";
    if (word.endsWith("и")) return word.slice(0, -1) + "я";
    return word;
  };

  return `${toNom(surname)} ${toNom(name)} ${toNom(patronymic)}`;
}

export function toGenitive(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length !== 3) return fullName;
  const [surname, name, patronymic] = parts;

  const female = isFemalePatronymic(patronymic);

  let surnameG: string;
  let nameG: string;
  let patrG: string;

  if (female) {
    if (/(?:ова|ева|ина|ына)$/.test(surname)) surnameG = surname.slice(0, -1) + "ой";
    else if (surname.endsWith("ская") || surname.endsWith("цкая")) surnameG = surname.slice(0, -2) + "ой";
    else if (surname.endsWith("я")) surnameG = surname.slice(0, -1) + "и";
    else if (surname.endsWith("а")) surnameG = surname.slice(0, -1) + "ы";
    else surnameG = surname;

    if (name.endsWith("я")) nameG = name.slice(0, -1) + "и";
    else if (name.endsWith("а")) nameG = name.slice(0, -1) + "ы";
    else if (name.endsWith("ь")) nameG = name.slice(0, -1) + "и";
    else nameG = name;

    if (patronymic.endsWith("на")) patrG = patronymic.slice(0, -1) + "ы";
    else patrG = patronymic;
  } else {
    if (/(?:ов|ев|ин|ын)$/.test(surname)) surnameG = surname + "а";
    else if (surname.endsWith("ский") || surname.endsWith("цкий")) surnameG = surname.slice(0, -2) + "ого";
    else if (surname.endsWith("ой")) surnameG = surname.slice(0, -2) + "ого";
    else if (surname.endsWith("ий")) surnameG = surname.slice(0, -2) + "ого";
    else if (surname.endsWith("ь")) surnameG = surname.slice(0, -1) + "я";
    else if (surname.endsWith("а")) surnameG = surname.slice(0, -1) + "ы";
    else surnameG = surname + "а";

    if (name.endsWith("й")) nameG = name.slice(0, -1) + "я";
    else if (name.endsWith("я")) nameG = name.slice(0, -1) + "и";
    else if (name.endsWith("а")) nameG = name.slice(0, -1) + "ы";
    else nameG = name + "а";

    patrG = patronymic + "а";
  }

  return `${surnameG} ${nameG} ${patrG}`;
}
