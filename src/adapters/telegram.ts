export async function sendTelegramMessage(params: { chat_id: string; text: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: params.chat_id, text: params.text, parse_mode: "HTML" }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}
