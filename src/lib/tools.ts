/**
 * Action Engine — определения tools для Claude (tool_use).
 * Все вызовы идут через /api/actions, где runtime проверяет права и вызывает адаптер.
 */

export const ACTION_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "remember_fact",
      description:
        "Сохранить долговременный факт в корпоративную память компании (о клиентах, договорённостях, правилах, ценах). Используй, когда пользователь явно просит запомнить или сообщает стабильную информацию. Если факт о конкретном клиенте — обязательно укажи client_id.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Факт одним предложением" },
          kind: {
            type: "string",
            enum: ["fact", "preference", "agreement", "rule"],
            description: "Тип факта",
          },
          client_id: {
            type: "string",
            description: "UUID клиента, если факт про конкретного клиента (опционально)",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description: "Отправить email клиенту от имени сотрудника. Требует подтверждения пользователя перед отправкой.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Email получателя" },
          subject: { type: "string" },
          body: { type: "string", description: "Текст письма в plain text или markdown" },
          client_id: { type: "string", description: "ID клиента в базе (опционально)" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_telegram",
      description: "Отправить сообщение в Telegram (через бота компании).",
      parameters: {
        type: "object",
        properties: {
          chat_id: { type: "string" },
          text: { type: "string" },
        },
        required: ["chat_id", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_meeting",
      description: "Создать встречу (Телемост/Zoom) и вернуть ссылку.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          datetime: { type: "string", description: "ISO 8601" },
          duration_minutes: { type: "number", default: 30 },
          attendees: { type: "array", items: { type: "string" }, description: "Email участников" },
        },
        required: ["title", "datetime"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_calendar",
      description: "Добавить событие в календарь сотрудника.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          datetime: { type: "string" },
          duration_minutes: { type: "number" },
          notes: { type: "string" },
        },
        required: ["title", "datetime"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_client",
      description:
        "Найти клиента в CRM по имени, контактному лицу, ИНН, email, телефону или фрагменту названия. Возвращает до 8 совпадений с краткими данными. Используй ВСЕГДА, когда пользователь упоминает клиента — даже если уверен, что знаешь его.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Поисковая фраза" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_client",
      description:
        "Получить ПОЛНУЮ карточку клиента по ID: реквизиты, подписант, банк, теги, заметки, файлы, договоры и факты памяти. Вызывай после find_client, когда нужно знать детали — до того, как генерировать договор/письмо.",
      parameters: {
        type: "object",
        properties: { client_id: { type: "string", description: "UUID клиента" } },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_clients",
      description:
        "Перечислить клиентов компании (по умолчанию 20 последних, с фильтром по статусу). Используй для вопросов «кто наши клиенты», «активные клиенты», «лиды».",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["lead", "active", "partner", "archived"],
            description: "Опционально: фильтр по статусу",
          },
          limit: { type: "number", description: "Сколько вернуть, max 50" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_client",
      description:
        "Обновить поля карточки клиента (реквизиты, контакты, статус, теги, summary). Передавай ТОЛЬКО изменяемые поля. Не сбрасывает остальные данные.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          name: { type: "string" },
          short_name: { type: "string" },
          legal_name: { type: "string" },
          contact: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          telegram: { type: "string" },
          website: { type: "string" },
          industry: { type: "string" },
          inn: { type: "string" },
          kpp: { type: "string" },
          ogrn: { type: "string" },
          bank_name: { type: "string" },
          bank_account: { type: "string" },
          corr_account: { type: "string" },
          bik: { type: "string" },
          legal_address: { type: "string" },
          actual_address: { type: "string" },
          signatory_name: { type: "string" },
          signatory_title: { type: "string" },
          signatory_basis: { type: "string" },
          status: { type: "string", enum: ["lead", "active", "partner", "archived"] },
          tags: { type: "array", items: { type: "string" } },
          summary: { type: "string", description: "Короткая выжимка про клиента (1–2 предложения)" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_client",
      description:
        "Создать нового клиента в CRM. Заполни как можно больше известных полей — реквизиты, контакты, подписанта, статус. Не выдумывай ИНН/банк — только то, что сообщил пользователь. После создания в карточку автоматически добавится заметка.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Название (как зовём компанию или клиента)" },
          short_name: { type: "string" },
          legal_name: { type: "string" },
          client_type: { type: "string", enum: ["legal", "individual"] },
          contact: { type: "string", description: "Контактное лицо (ФИО)" },
          phone: { type: "string" },
          email: { type: "string" },
          telegram: { type: "string" },
          website: { type: "string" },
          industry: { type: "string" },
          inn: { type: "string" },
          kpp: { type: "string" },
          ogrn: { type: "string" },
          bank_name: { type: "string" },
          bank_account: { type: "string" },
          corr_account: { type: "string" },
          bik: { type: "string" },
          legal_address: { type: "string" },
          actual_address: { type: "string" },
          signatory_name: { type: "string" },
          signatory_title: { type: "string" },
          signatory_basis: { type: "string" },
          status: { type: "string", enum: ["lead", "active", "partner", "archived"] },
          tags: { type: "array", items: { type: "string" } },
          summary: { type: "string", description: "1–2 предложения чем занимается клиент / зачем нам важен" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_client_note",
      description:
        "Добавить заметку (запись в историю общения) к карточке клиента. Используй, когда пользователь даёт информацию о звонке, встрече, договорённости — а полноценный fact для памяти не подходит.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          content: { type: "string", description: "Текст заметки" },
          source: {
            type: "string",
            enum: ["manual", "chat", "call", "email", "meeting"],
          },
        },
        required: ["client_id", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_text_templates",
      description:
        "Перечислить ТЕКСТОВЫЕ шаблоны компании (для писем, КП, типовых ответов). Не путать с DOCX-договорами — для них list_contract_templates.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_text_template",
      description:
        "Создать текстовый шаблон письма / КП / ответа. В body можно использовать markdown (**жирный**, заголовки, списки, картинки ![alt](url)) и переменные {{client.greeting}}, {{client.name}}, {{client.email}}, {{client.legal_name}}, {{client.inn}}, {{user.name}}, {{date}} и т.д. ВАЖНО: для приветствия используй {{client.greeting}} — он вернёт имя контактного лица если оно есть, иначе короткое название клиента. Не пиши фиксированные имена клиентов в шаблон.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Название шаблона (напр., «Холодное письмо»)" },
          body: {
            type: "string",
            description:
              "Текст шаблона с переменными {{client.greeting}}, {{client.name}} и т.п. Можно markdown.",
          },
        },
        required: ["name", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_text_template",
      description: "Обновить существующий текстовый шаблон (имя или тело).",
      parameters: {
        type: "object",
        properties: {
          template_id: { type: "string" },
          name: { type: "string" },
          body: { type: "string" },
        },
        required: ["template_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_text_template",
      description: "Удалить текстовый шаблон по id.",
      parameters: {
        type: "object",
        properties: { template_id: { type: "string" } },
        required: ["template_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_contract_templates",
      description:
        "Список доступных DOCX-шаблонов договоров компании. Используй, когда пользователь просит составить договор, чтобы выбрать подходящий шаблон.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_contracts",
      description:
        "Список ранее сгенерированных договоров. Можно фильтровать по client_id или искать по имени/шаблону.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Опционально: только договоры этого клиента" },
          query: { type: "string", description: "Поиск по имени файла/шаблона" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ai_create_contract",
      description:
        "Сгенерировать DOCX-договор из шаблона компании, автоподставив реквизиты клиента. Сохраняет результат в раздел Документы и возвращает ссылку на скачивание. Если template_id не задан — выбери самый подходящий из list_contract_templates по контексту (например, по описанию или по словам в названии).",
      parameters: {
        type: "object",
        properties: {
          template_id: { type: "string", description: "UUID шаблона из list_contract_templates" },
          client_id: { type: "string", description: "UUID клиента — реквизиты подставятся автоматически" },
          variables: {
            type: "object",
            additionalProperties: { type: "string" },
            description:
              "Доп. поля, которых нет в карточке клиента (предмет договора, сумма, сроки и т.п.). Ключи в snake_case как в шаблоне.",
          },
          name: { type: "string", description: "Понятное имя файла, опционально" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_document",
      description:
        "Старая текстовая генерация по простому шаблону {{client.name}}. Для DOCX-договоров используй ai_create_contract.",
      parameters: {
        type: "object",
        properties: {
          template_id: { type: "string" },
          client_id: { type: "string" },
          variables: { type: "object", additionalProperties: true },
        },
        required: ["template_id"],
      },
    },
  },
];

/** Список «опасных» действий — требуют явного подтверждения в UI. */
export const CONFIRM_REQUIRED = new Set(["send_email", "send_telegram"]);

/** Тулы, которые безопасно/полезно выполнять автоматически без UI-подтверждения
 *  (read-only поиск или не-разрушительная запись). */
export const AUTO_RUN_TOOLS = new Set<string>([
  "find_client",
  "get_client",
  "list_clients",
  "list_contract_templates",
  "list_contracts",
  "list_text_templates",
  "create_text_template",
  "update_text_template",
  "create_client",
  "update_client",
  "save_client_note",
  "remember_fact",
]);
