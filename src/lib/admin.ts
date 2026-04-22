/**
 * Гейт супер-админа (платформенного, не company-level).
 * Список email через env: ADMIN_EMAILS=foo@bar.com,baz@qux.com
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperadmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
