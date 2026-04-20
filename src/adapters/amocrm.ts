/** AmoCRM — заглушка. Реальная реализация: OAuth2 + REST /api/v4/contacts, /leads. */
export async function amocrmFindContact(_query: string) {
  return { ok: false, error: "AmoCRM adapter not configured" };
}
