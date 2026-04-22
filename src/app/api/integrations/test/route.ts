import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { type, config } — "лёгкая" проверка соединения.
 * Для MVP — делаем минимальные запросы (без отправки реальных писем/сообщений).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  const config = (body.config ?? {}) as Record<string, string>;

  try {
    switch (type) {
      case "email":
        return await testPostmark(config);
      case "telegram":
        return await testTelegram(config);
      case "amocrm":
        return await testAmo(config);
      case "bitrix24":
        return await testBitrix(config);
      case "google_calendar":
        return await testGoogle(config);
      default:
        return Response.json({ ok: false, error: "unknown type" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ ok: false, detail: (e as Error).message }, { status: 200 });
  }
}

async function testPostmark(c: Record<string, string>) {
  const token = c.server_token;
  if (!token) return Response.json({ ok: false, detail: "server_token required" });
  const res = await fetch("https://api.postmarkapp.com/server", {
    headers: { "X-Postmark-Server-Token": token, Accept: "application/json" },
  });
  if (res.ok) return Response.json({ ok: true, detail: "Postmark отвечает" });
  return Response.json({ ok: false, detail: `Postmark ${res.status}` });
}

async function testTelegram(c: Record<string, string>) {
  const token = c.bot_token;
  if (!token) return Response.json({ ok: false, detail: "bot_token required" });
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.ok)
    return Response.json({ ok: true, detail: `Бот @${json.result?.username ?? "?"}` });
  return Response.json({ ok: false, detail: json.description ?? `telegram ${res.status}` });
}

async function testAmo(c: Record<string, string>) {
  const { domain, long_lived_token } = c;
  if (!domain || !long_lived_token)
    return Response.json({ ok: false, detail: "domain и токен обязательны" });
  const res = await fetch(`https://${domain}/api/v4/account`, {
    headers: { Authorization: `Bearer ${long_lived_token}` },
  });
  if (res.ok) {
    const json = await res.json().catch(() => ({}));
    return Response.json({ ok: true, detail: `AmoCRM: ${json.name ?? domain}` });
  }
  return Response.json({ ok: false, detail: `AmoCRM ${res.status}` });
}

async function testBitrix(c: Record<string, string>) {
  const url = c.webhook_url;
  if (!url) return Response.json({ ok: false, detail: "webhook_url required" });
  const norm = url.endsWith("/") ? url : url + "/";
  const res = await fetch(`${norm}user.current.json`);
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.result) {
    return Response.json({ ok: true, detail: `Bitrix24: ${json.result?.NAME ?? "ok"}` });
  }
  return Response.json({ ok: false, detail: json.error_description ?? `bitrix ${res.status}` });
}

async function testGoogle(c: Record<string, string>) {
  // Полная проверка JWT-токена Google SA тяжёлая для MVP — валидируем только форму
  if (!c.service_account_email || !c.service_account_key) {
    return Response.json({ ok: false, detail: "email и key обязательны" });
  }
  if (!/-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(c.service_account_key)) {
    return Response.json({ ok: false, detail: "похоже, не PEM-ключ" });
  }
  return Response.json({ ok: true, detail: "Формат ключа валиден (полный тест запустится при первом событии)" });
}
