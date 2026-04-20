const POSTMARK_API = "https://api.postmarkapp.com/email";

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}) {
  const apiKey = process.env.POSTMARK_API_KEY;
  const from = params.from ?? process.env.POSTMARK_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "POSTMARK not configured" };
  }

  const res = await fetch(POSTMARK_API, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": apiKey,
    },
    body: JSON.stringify({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.body,
      MessageStream: "outbound",
    }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true, message_id: (await res.json()).MessageID as string };
}
