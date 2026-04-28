"""
generator.py — ядро генерации договоров.

Принимает:
  - путь к шаблону .docx
  - конфиг (dict с правилами замен)
  - данные (dict с заполненными полями)
Возвращает: путь к готовому .docx.

Использует утилиты из /mnt/skills/public/docx/scripts/office/ для unpack/pack.
"""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import os

# Путь до утилит docx (unpack/pack).
# По умолчанию ищем в стандартном месте на Anthropic-окружении, потом — локально
# в папке `office_scripts/` рядом с этим файлом, потом — в ENV.
_DEFAULT_PATHS = [
    Path("/mnt/skills/public/docx/scripts/office"),
    Path(__file__).parent / "office_scripts",
]
SKILLS_OFFICE = Path(os.environ.get("SKILLS_OFFICE", "")) if os.environ.get("SKILLS_OFFICE") else None
if SKILLS_OFFICE is None:
    for p in _DEFAULT_PATHS:
        if p.exists() and (p / "unpack.py").exists():
            SKILLS_OFFICE = p
            break
if SKILLS_OFFICE is None:
    # Fallback — оставим первый путь, ошибка выскочит при первом вызове
    SKILLS_OFFICE = _DEFAULT_PATHS[0]


# === Преобразования для computed_fields ===

def _strip_trailing_dot(value: str) -> str:
    return value.rstrip(".")


def _first_part_of_date(value: str) -> str:
    # 28.04.2026 → 28
    return value.split(".")[0] if "." in value else value


TRANSFORMS = {
    "strip_trailing_dot": _strip_trailing_dot,
    "first_part_of_date": _first_part_of_date,
}


# === Основные операции ===

def load_config(config_path: str | Path) -> dict[str, Any]:
    with open(config_path, encoding="utf-8") as f:
        return json.load(f)


def compute_derived_fields(config: dict, data: dict) -> dict:
    """Достраивает computed_fields на основе data."""
    enriched = dict(data)
    for cf in config.get("computed_fields", []):
        src_value = enriched.get(cf["from_field"], "")
        transform = TRANSFORMS.get(cf["transform"])
        if transform is None:
            raise ValueError(f"Неизвестное преобразование: {cf['transform']}")
        enriched[cf["key"]] = transform(src_value)
    return enriched


def render_replacements(config: dict, data: dict) -> tuple[list[dict], list[str]]:
    """
    Подставляет {{key}} в правилах замены значениями из data.
    Возвращает (правила, предупреждения о пустых/неизвестных полях).
    """
    enriched = compute_derived_fields(config, data)
    rendered = []
    pre_warnings: list[str] = []

    # Собираем все ключи, которые упоминаются в шаблонах замен
    placeholder_pattern = re.compile(r"\{\{(\w+)\}\}")
    used_keys: set[str] = set()
    for rule in config["replacements"]:
        used_keys.update(placeholder_pattern.findall(rule["replace"]))

    # Предупреждаем о пустых/отсутствующих
    for key in used_keys:
        if key not in enriched or enriched[key] in (None, ""):
            # Пропускаем "опциональные" по умолчанию — телефон контакта
            if key in ("spec_contact_phone",):
                continue
            pre_warnings.append(f"Поле «{key}» пустое — в документе подставится пустая строка")

    for rule in config["replacements"]:
        replace_str = rule["replace"]
        # Подставляем все {{key}} → data[key] или ""
        def _sub(m):
            key = m.group(1)
            return str(enriched.get(key, ""))
        replace_str = placeholder_pattern.sub(_sub, replace_str)
        rendered.append({
            "find": rule["find"],
            "replace": replace_str,
            "count": rule.get("count"),
        })
    return rendered, pre_warnings


def apply_replacements(xml_text: str, rules: list[dict], strict: bool = True) -> tuple[str, list[str]]:
    """Применяет правила к XML. Возвращает (новый_xml, список_предупреждений)."""
    warnings = []
    for rule in rules:
        find_str = rule["find"]
        replace_str = rule["replace"]
        expected_count = rule.get("count")

        actual_count = xml_text.count(find_str)
        if actual_count == 0:
            warnings.append(f"Не найдено в шаблоне: {find_str[:80]}")
            if strict:
                continue
            continue
        if expected_count is not None and actual_count != expected_count:
            warnings.append(
                f"Ожидалось {expected_count} вхождений, найдено {actual_count}: {find_str[:80]}"
            )

        xml_text = xml_text.replace(find_str, replace_str)
    return xml_text, warnings


def generate_contract(
    template_docx: str | Path,
    config: dict,
    data: dict,
    output_docx: str | Path,
    strict: bool = False,
) -> dict:
    """
    Генерирует договор.

    Возвращает dict с:
      - output_path: путь к готовому файлу
      - warnings: список предупреждений
      - replacements_applied: количество применённых правил
    """
    template_docx = Path(template_docx)
    output_docx = Path(output_docx)

    if not template_docx.exists():
        raise FileNotFoundError(f"Шаблон не найден: {template_docx}")

    output_docx.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        unpack_dir = Path(tmpdir) / "unpacked"

        # 1. Распаковываем
        result = subprocess.run(
            [sys.executable, str(SKILLS_OFFICE / "unpack.py"), str(template_docx), str(unpack_dir)],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"Ошибка распаковки: {result.stderr}")

        # 2. Применяем замены к document.xml
        doc_xml_path = unpack_dir / "word" / "document.xml"
        xml_text = doc_xml_path.read_text(encoding="utf-8")

        rules, pre_warnings = render_replacements(config, data)
        new_xml, replace_warnings = apply_replacements(xml_text, rules, strict=strict)
        warnings = pre_warnings + replace_warnings

        doc_xml_path.write_text(new_xml, encoding="utf-8")

        # 3. Упаковываем
        result = subprocess.run(
            [sys.executable, str(SKILLS_OFFICE / "pack.py"),
             str(unpack_dir), str(output_docx),
             "--original", str(template_docx)],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"Ошибка упаковки: {result.stderr}\n{result.stdout}")

    return {
        "output_path": str(output_docx),
        "warnings": warnings,
        "replacements_applied": len(rules),
    }


# === Парсинг реквизитов из текста ===

import re

def parse_requisites(text: str) -> dict[str, str]:
    """
    Извлекает реквизиты из произвольного текста.
    Возвращает только те поля, которые удалось найти.

    Эвристики «достаточно хороши» для типичных карточек контрагента.
    Сложные случаи (несколько ИНН в одном тексте, управляющие организации
    и т.п.) лучше передавать в ai_parse_requisites().
    """
    out: dict[str, str] = {}

    # === Наименования ===
    # Полное — берём первое вхождение, обрываем на скобке/запятой/переводе строки.
    # Устойчиво к markdown-форматированию (звёздочки между словами).
    cleaned = re.sub(r"\*+", "", text)  # убираем markdown-bold
    m = re.search(
        r"Общество\s+с\s+ограниченной\s+ответственностью\s+[«\"]([^»\"]+)[»\"]",
        cleaned, re.IGNORECASE
    )
    if m:
        out["client_full_name"] = f"Общество с ограниченной ответственностью «{m.group(1)}»"
        out["client_short_name"] = f"ООО «{m.group(1)}»"

    # Если "ООО «...»" встречается отдельно — может уточнить short
    m2 = re.search(r"ООО\s*[«\"]([^»\"]+)[»\"]", cleaned)
    if m2 and "client_short_name" not in out:
        out["client_short_name"] = f"ООО «{m2.group(1)}»"

    # === ИНН/КПП/ОГРН ===
    # Берём ПЕРВОЕ вхождение каждого — обычно это и есть «свой» контрагент.
    # (Если в тексте несколько компаний — это уже задача для ИИ.)
    m = re.search(r"ИНН[:\s]*(\d{10}|\d{12})", text)
    if m:
        out["client_inn"] = m.group(1)

    m = re.search(r"КПП[:\s\-]*(\d{9})", text)
    if m:
        out["client_kpp"] = m.group(1)

    m = re.search(r"ОГРН[:\s]*(\d{13,15})", text)
    if m:
        out["client_ogrn"] = m.group(1)

    # === Счета и БИК ===
    m = re.search(r"(?:Р/с[чч]?|р/с[чч]?|Расч[её]тный\s+сч[её]т)[\s\.:№]*(\d{20})",
                  text, re.IGNORECASE)
    if m:
        out["client_account"] = m.group(1)

    m = re.search(r"(?:К/с[чч]?|к/с[чч]?|корр[\.\s]*сч[её]т)[\s\.:№]*(\d{20})",
                  text, re.IGNORECASE)
    if m:
        out["client_corr_account"] = m.group(1)

    m = re.search(r"БИК[:\s]*(\d{9})", text)
    if m:
        out["client_bik"] = m.group(1)

    # === Email — обрезаем хвостовые знаки препинания ===
    m = re.search(r"[Ee][\-\s]?mail[:\s]*([\w\.\-+]+@[\w\.\-]+\.[a-zA-Z]{2,})", text)
    if m:
        out["client_email"] = m.group(1).rstrip(".,;: ")

    # === Банк ===
    bank = None
    # 1) "Банк: ..." — типовой формат
    m = re.search(r"Банк[:\s]+([^\n]+?)(?:\n|$)", text)
    if m:
        candidate = m.group(1).strip().rstrip(",.;")
        if not candidate.isdigit() and 3 < len(candidate) < 200:
            bank = candidate

    # 2) Строка с упоминанием БАНК / СБЕРБАНК / ВТБ / АЛЬФА — выбираем
    if not bank:
        for line in text.split("\n"):
            line_clean = re.sub(r"\*+", "", line).strip().rstrip(",.;:")
            if not line_clean:
                continue
            up = line_clean.upper()
            # Признак банковского названия: содержит БАНК/СБЕРБАНК/ВТБ/АЛЬФА и НЕ начинается с БИК/р/с/к/с
            if (re.search(r"(БАНК|СБЕРБАНК|ВТБ|АЛЬФА|ТИНЬКОФФ|ОТКРЫТИЕ|ГАЗПРОМ)", up)
                    and not up.startswith(("БИК", "Р/С", "К/С", "ОГРН", "ИНН", "КПП"))
                    and "БАНКОВСК" not in up
                    and 5 < len(line_clean) < 200):
                bank = line_clean
                break
    if bank:
        out["client_bank"] = bank

    # === Адреса ===
    # Юр. + факт. одной строкой ("Юридический адрес и фактический адрес: ...")
    m = re.search(
        r"Юридический\s+(?:адрес\s+)?и\s+фактический\s+адрес[:\s]+(.+?)(?=\n\s*(?:Тел|E[\-\s]?mail|ОГРН|ИНН|КПП|$)|$)",
        text, re.IGNORECASE | re.DOTALL
    )
    if m:
        addr = " ".join(m.group(1).split()).rstrip(",.;")
        out["client_legal_address"] = addr
        out["client_actual_address"] = addr
    else:
        # Юр. адрес отдельно
        m = re.search(
            r"Юридический\s+адрес[:\s]+(.+?)(?=\n\s*(?:Фактический|Тел|E[\-\s]?mail|ОГРН|ИНН|$)|$)",
            text, re.IGNORECASE | re.DOTALL
        )
        if m:
            addr = " ".join(m.group(1).split()).rstrip(",.;")
            out["client_legal_address"] = addr

        # Факт. адрес
        m = re.search(
            r"Фактический\s+адрес[:\s]+(.+?)(?=\n\s*(?:Тел|E[\-\s]?mail|ОГРН|ИНН|$)|$)",
            text, re.IGNORECASE | re.DOTALL
        )
        if m:
            addr = " ".join(m.group(1).split()).rstrip(",.;")
            out["client_actual_address"] = addr

        # Если факт.адрес не нашли, но есть юр — копируем
        if "client_legal_address" in out and "client_actual_address" not in out:
            out["client_actual_address"] = out["client_legal_address"]

    # === Подписант ===
    # Ищем "Генеральный директор - ФИО" или "в лице Генерального директора ФИО"
    m = re.search(
        r"(?:в\s+лице\s+)?Генерального?\s+директора?[\s\-–—,]+([А-ЯЁ][а-яё]+(?:ой|ова|ева)?\s+[А-ЯЁ][а-яё]+(?:ы|и|ой|ы)?\s+[А-ЯЁ][а-яё]+(?:ы|и|ой|ы|вны|чны)?)",
        text
    )
    if not m:
        # Запасной вариант — простой шаблон ФИО в именительном падеже после "Генеральный директор"
        m = re.search(
            r"Генеральный\s+директор[\s\-–—:]+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)",
            text
        )

    if m:
        # Восстанавливаем именительный падеж (если нашли в родительном)
        full_name_raw = m.group(1).strip()
        full_name = _to_nominative(full_name_raw)

        out["client_signatory_title"] = "Генеральный директор"
        parts = full_name.split()
        if len(parts) == 3:
            out["client_signatory_short"] = f"{parts[0]} {parts[1][0]}.{parts[2][0]}."

            # Определяем пол по отчеству
            patronymic = parts[2]
            is_female = patronymic.endswith(("вна", "чна", "шна"))
            participle = "действующей" if is_female else "действующего"

            out["client_signatory_clause"] = (
                f"в лице Генерального директора {_to_genitive(full_name)}, "
                f"{participle} на основании Устава"
            )

    return out


def _to_nominative(full_name: str) -> str:
    """
    Если ФИО найдено в родительном падеже — возвращает именительный.
    Эвристика, не идеал. Для точных результатов — ИИ.
    """
    parts = full_name.split()
    if len(parts) != 3:
        return full_name
    surname, name, patronymic = parts

    # Женские фамилии в Р.п.: Антоновой → Антонова, Ивановой → Иванова
    def to_nom(word: str) -> str:
        # Вновь типичные окончания родительного падежа
        if word.endswith("ой"):
            return word[:-2] + "а"
        if word.endswith("ы"):
            return word[:-1] + "а"
        if word.endswith("и"):
            return word[:-1] + "я"
        return word

    return f"{to_nom(surname)} {to_nom(name)} {to_nom(patronymic)}"


def _to_genitive(full_name: str) -> str:
    """
    Очень грубая попытка склонения ФИО в родительный падеж.
    Точное склонение оставляем ИИ. Здесь — только базовые окончания
    для типичных случаев, чтобы было удобоваримо.

    Примеры (женский род):
      Антонова Светлана Александровна → Антоновой Светланы Александровны
      Иванова Мария Петровна → Ивановой Марии Петровны
    Примеры (мужской род):
      Иванов Иван Иванович → Иванова Ивана Ивановича
      Тарасов Кирилл Игоревич → Тарасова Кирилла Игоревича
    """
    parts = full_name.split()
    if len(parts) != 3:
        return full_name
    surname, name, patronymic = parts

    # Определяем пол по отчеству
    is_female = patronymic.endswith(("вна", "чна", "шна"))

    if is_female:
        # Женские формы
        # Фамилии на -ова/-ева/-ина/-ская → родительный на -ой/-ской
        if surname.endswith(("ова", "ева", "ина", "ына")):
            surname_g = surname[:-1] + "ой"
        elif surname.endswith("ская") or surname.endswith("цкая"):
            surname_g = surname[:-2] + "ой"
        elif surname.endswith("я"):
            surname_g = surname[:-1] + "и"
        elif surname.endswith("а"):
            surname_g = surname[:-1] + "ы"
        else:
            surname_g = surname  # несклоняемая

        # Имена: Светлана → Светланы, Мария → Марии, Любовь → Любови
        if name.endswith("я"):
            name_g = name[:-1] + "и"
        elif name.endswith("а"):
            name_g = name[:-1] + "ы"
        elif name.endswith("ь"):
            name_g = name[:-1] + "и"
        else:
            name_g = name

        # Отчества: Александровна → Александровны
        if patronymic.endswith("на"):
            patr_g = patronymic[:-1] + "ы"
        else:
            patr_g = patronymic

        return f"{surname_g} {name_g} {patr_g}"

    # Мужские формы
    # Фамилии на -ов/-ев/-ин → +а
    if surname.endswith(("ов", "ев", "ин", "ын")):
        surname_g = surname + "а"
    elif surname.endswith("ский") or surname.endswith("цкий"):
        surname_g = surname[:-2] + "ого"
    elif surname.endswith("ой"):
        surname_g = surname[:-2] + "ого"
    elif surname.endswith("ий"):
        surname_g = surname[:-2] + "ого"
    elif surname.endswith("ь"):
        surname_g = surname[:-1] + "я"
    elif surname.endswith("а"):
        surname_g = surname[:-1] + "ы"
    else:
        surname_g = surname + "а"

    # Имена: Иван → Ивана, Кирилл → Кирилла, Андрей → Андрея, Илья → Ильи
    if name.endswith("й"):
        name_g = name[:-1] + "я"
    elif name.endswith("я"):
        name_g = name[:-1] + "и"
    elif name.endswith("а"):
        name_g = name[:-1] + "ы"
    else:
        name_g = name + "а"

    # Отчества: Иванович → Ивановича, Игоревич → Игоревича
    if patronymic.endswith("ич"):
        patr_g = patronymic + "а"
    else:
        patr_g = patronymic + "а"

    return f"{surname_g} {name_g} {patr_g}"


# === ИИ-парсер (заглушка под подключение API) ===

def ai_parse_requisites(text: str, api_callback=None) -> dict[str, str]:
    """
    Заглушка. api_callback: функция (text, system_prompt) -> json_string.

    Когда подключишь свой API: передай callback, который получает текст и
    инструкцию, отправляет в свой LLM-API и возвращает JSON-строку с полями.
    """
    if api_callback is None:
        # Без API — просто regex-парсер
        return parse_requisites(text)

    system_prompt = (
        "Ты извлекаешь реквизиты компании из текста. Верни ТОЛЬКО JSON-объект "
        "с полями: client_full_name, client_short_name, client_inn, client_kpp, "
        "client_ogrn, client_account, client_bank, client_corr_account, client_bik, "
        "client_email, client_legal_address, client_actual_address, "
        "client_signatory_title, client_signatory_short, client_signatory_clause. "
        "Если поле не найдено — пропусти его. ФИО подписанта в client_signatory_clause "
        "склоняй в родительный падеж: «в лице Генерального директора Иванова Ивана Ивановича, "
        "действующего на основании Устава»."
    )
    response = api_callback(text, system_prompt)
    return json.loads(response)
