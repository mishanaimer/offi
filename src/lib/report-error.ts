/**
 * Лёгкий error-reporter без npm-зависимостей.
 * - Всегда: console.error с маркером "[OFFI_ERR]" — ищется в Vercel Logs
 * - Опционально: HTTP-уведомление в Telegram при критичных ошибках
 *   (env TG_ALERT_BOT_TOKEN + TG_ALERT_CHAT_ID)
 *
 * Когда захочется Sentry — заменить тело reportError, не трогая call-sites.
 */

export type ErrorContext = {
  route?: string;
  userId?: string;
  companyId?: string;
  level?: "error" | "warn" | "fatal";
  extra?: Record<string, unknown>;
};

const TG_TOKEN = process.env.TG_ALERT_BOT_TOKEN;
const TG_CHAT = process.env.TG_ALERT_CHAT_ID;

function safeStringify(v: unknown): string {
  try {
    if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ""}`;
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

async function notifyTelegram(text: string) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text: text.slice(0, 3800),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // alerting не должен ломать обработчик — игнорируем
  }
}

export async function reportError(error: unknown, context: ErrorContext = {}) {
  const tag = `[OFFI_ERR]${context.level ? `[${context.level.toUpperCase()}]` : ""}${context.route ? `[${context.route}]` : ""}`;
  const payload = {
    msg: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };

  console.error(tag, safeStringify(payload));

  if (context.level === "fatal" || context.level === "error") {
    const text =
      `<b>${tag}</b>\n` +
      `<code>${escapeHtml(payload.msg)}</code>\n` +
      (context.route ? `route: ${context.route}\n` : "") +
      (context.companyId ? `company: ${context.companyId}\n` : "") +
      (payload.stack ? `\n<pre>${escapeHtml(payload.stack.slice(0, 1500))}</pre>` : "");
    void notifyTelegram(text);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
