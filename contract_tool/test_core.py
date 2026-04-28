"""Тест ядра генератора на данных ЭДИФАРМ."""
import sys
sys.path.insert(0, "/home/claude/contract_tool")
from generator import load_config, generate_contract

config = load_config("/home/claude/contract_tool/configs/aisystems_internet.json")

data = {
    "contract_number": "28/0426",
    "contract_day": "28",
    "contract_month": "апреля",
    "contract_year": "2026",
    "act_date_short": "28.04.2026",
    "act_day_padded": "28",
    "act_city": "Санкт-Петербург",
    "service_start_date": "06.05.2026",

    "client_full_name": "Общество с ограниченной ответственностью «ЭДИФАРМ»",
    "client_short_name": "ООО «ЭДИФАРМ»",
    "client_signatory_clause": "в лице Генерального директора Антоновой Светланы Александровны, действующей на основании Устава",
    "client_signatory_short": "Антонова С.А.",
    "client_signatory_title": "Генеральный директор",

    "client_legal_address": "199178, г. Санкт-Петербург, пр. Средний В.О., дом 65, лит. А, офис Э/ПОМ/Ч.П. 1/2-Н/2",
    "client_actual_address": "197375, г. Санкт-Петербург, ул. Маршала Новикова, д. 28, корп. 2, лит. А",

    "client_inn": "7801121793",
    "client_kpp": "780101001",
    "client_ogrn": "1037800002426",
    "client_account": "40702810755070001360",
    "client_bank": "ПАО Сбербанк",
    "client_corr_account": "30101810500000000653",
    "client_bik": "044030653",
    "client_email": "office@aloea.ru",

    "spec_contact_name": "Петр",
    "spec_contact_phone": "",
    "spec_contact_email": "Gnilobokov.petr@bsspharm.ru",

    "service_address": "Аптека на трамвайном (А-235/29). Контактное лицо на точке: Королева Ольга Викторовна, +79500391582",
    "service_address_short": "Аптека на трамвайном (А-235/29)",
}

result = generate_contract(
    template_docx="/home/claude/contract_tool/templates_docx/aisystems_internet.docx",
    config=config,
    data=data,
    output_docx="/home/claude/contract_tool/output/test_edifarm.docx"
)
print("Файл:", result["output_path"])
print("Применено правил:", result["replacements_applied"])
print("Предупреждений:", len(result["warnings"]))
for w in result["warnings"]:
    print("  ⚠", w)
