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
        "Сохранить долговременный факт в корпоративную память компании (о клиентах, договорённостях, правилах, ценах). Используй, когда пользователь явно просит запомнить или сообщает стабильную информацию.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Факт одним предложением" },
          kind: {
            type: "string",
            enum: ["fact", "preference", "agreement", "rule"],
            description: "Тип факта",
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
      description: "Найти клиента в базе по имени, компании или email.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_document",
      description: "Сгенерировать документ из шаблона с подставленными данными клиента.",
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
