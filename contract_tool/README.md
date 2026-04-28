# Контракт-генератор Айсистемс

Локальный веб-инструмент для генерации договоров по шаблонам .docx.

## Что умеет

- Веб-интерфейс на `localhost:5000` — выбор шаблона, форма, превью, скачивание
- Парсер реквизитов из произвольного текста (ИНН/КПП/ОГРН/счета/БИК/адреса/ФИО)
- Склонение ФИО подписанта в родительный падеж с учётом пола
- Превью договора в браузере перед скачиванием
- Автосохранение формы в localStorage (F5 не теряет данные)
- Множественные шаблоны — можно добавлять новые без изменения кода
- Хук под подключение собственного LLM-API для умного парсинга

## Установка

Требуется:
- Python 3.10+
- LibreOffice (для конвертации шаблонов и превью)
- pandoc (для extract-text при отладке, опционально)

```bash
pip install flask
```

Также нужен набор скриптов из Anthropic skill `docx`:
- `unpack.py`, `pack.py`, `soffice.py` в `/mnt/skills/public/docx/scripts/office/`
- Если переносишь на свой сервер — скопируй эти скрипты и поправь путь
  `SKILLS_OFFICE` в `generator.py`

## Запуск

```bash
cd contract_tool
python3 app.py
```

Открой `http://127.0.0.1:5000`.

## Структура проекта

```
contract_tool/
├── app.py                    # Flask-приложение
├── generator.py              # Ядро: парсинг реквизитов + генерация договора
├── test_core.py              # Smoke-тест ядра без UI
├── templates_docx/           # Исходные .docx-шаблоны
│   └── aisystems_internet.docx
├── configs/                  # JSON-конфиги маппинга полей
│   └── aisystems_internet.json
├── templates_html/           # Jinja-шаблоны интерфейса
│   ├── base.html
│   ├── index.html
│   └── fill.html
└── output/                   # Сгенерированные договоры
```

## Как добавить новый шаблон

1. Положи .docx в `templates_docx/my_template.docx`.
2. Создай JSON-конфиг `configs/my_template.json` по образцу `aisystems_internet.json`.
3. Перезапусти Flask. Шаблон сразу появится на главной.

### Структура JSON-конфига

```json
{
  "name": "Название шаблона (показывается на главной)",
  "description": "Краткое описание",
  "docx_file": "my_template.docx",

  "fields": [
    {
      "key": "client_inn",
      "label": "ИНН",
      "placeholder": "7801121793",
      "type": "text",          // text | textarea
      "hint": "10 или 12 цифр", // опционально
      "required": true          // опционально
    }
  ],

  "replacements": [
    {
      "find": "<w:t>СТАРЫЙ_ТЕКСТ_В_ШАБЛОНЕ</w:t>",
      "replace": "<w:t>{{client_inn}}</w:t>",
      "count": 1   // null = заменить все вхождения; число = ровно столько (валидация)
    }
  ],

  "computed_fields": [
    // Опционально: вычисляемые поля на основе других
    {
      "key": "client_signatory_short_no_dot",
      "from_field": "client_signatory_short",
      "transform": "strip_trailing_dot"
    }
  ]
}
```

### Как найти точные строки `<w:t>...</w:t>` для нового шаблона

```bash
python3 /mnt/skills/public/docx/scripts/office/unpack.py templates_docx/my_template.docx /tmp/unpacked
grep -n "ТЕКСТ_КОТОРЫЙ_ИЩУ" /tmp/unpacked/word/document.xml
```

Скопируй точные строки `<w:t>...</w:t>` (со всеми атрибутами вроде `xml:space="preserve"`)
в поле `find` JSON-конфига.

**Важно:** если фраза в шаблоне разбита на несколько `<w:r>` (это часто случается
из-за форматирования — например `БИК: ` и число — отдельные runs), нужно либо
заменять только число, либо предварительно "схлопнуть" runs функцией
`unpack.py` (она это делает по умолчанию).

## Подключение собственного LLM-API

В `generator.py` есть функция-заглушка:

```python
def ai_parse_requisites(text: str, api_callback=None) -> dict[str, str]:
    ...
```

Чтобы подключить свой API — передавай callback, который принимает `(text, system_prompt)`
и возвращает JSON-строку с распознанными полями. Например:

```python
def my_llm(text, system_prompt):
    response = requests.post(
        "https://my-llm-api.example.com/chat",
        json={"system": system_prompt, "user": text, "format": "json"}
    )
    return response.json()["content"]

parsed = ai_parse_requisites(card_text, api_callback=my_llm)
```

В endpoint `/parse` (`app.py`) можно подменить вызов `parse_requisites(text)` на
`ai_parse_requisites(text, api_callback=my_llm)`.

## Использование ядра без UI

```python
from generator import load_config, generate_contract

config = load_config("configs/aisystems_internet.json")
data = {
    "contract_number": "28/0426",
    "client_short_name": "ООО «АЛОЭ»",
    # ... остальные поля
}
result = generate_contract(
    template_docx="templates_docx/aisystems_internet.docx",
    config=config,
    data=data,
    output_docx="my_contract.docx"
)
print(result["warnings"])  # пусто если всё ок
```

## Известные ограничения v1

- **Парсер банка** работает только если в тексте есть слово "Банк:" или название
  типа "Сбербанк/ВТБ/Альфа". Для нестандартных названий банков подключай ИИ.
- **Управляющие организации** парсер не разбирает корректно (берёт первое попавшееся
  ООО) — заполняй вручную или через ИИ.
- **Склонение ФИО** работает для типичных русских ФИО на -ов/-ев/-ин, женских на
  -ова/-ева. Сложные случаи (несклоняемые фамилии, иностранные ФИО) — вручную.
- **Поле телефона** в спецификации необязательное (часто бывает пустым).

## Известные особенности шаблона Айсистемс

- В оригинале шаблона МЕДИКОМ в Акте было захардкожено "г. Москва" — параметризовано
  через поле `act_city` (по умолчанию "Санкт-Петербург").
- В реквизитах МЕДИКОМ КПП был с дефисом (`КПП -290501001`) — в новых договорах
  дефис убран.
- Дата включения услуги в Акте по умолчанию ставится через поле `service_start_date`.
- Цена 0 ₽ + тестовый период 14 дней зашиты в шаблон — для платных договоров
  потребуется отдельный шаблон.
