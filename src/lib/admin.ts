/**
 * Гейт супер-админа (платформенного, не company-level).
 * Список email через env: ADMIN_EMAILS=foo@bar.com,baz@qux.com
 * Плюс дефолтный встроенный список (владелец платформы).
 */
const BUILTIN_ADMINS = ["gign230102@gmail.com", "ngig45@yandex.ru"];

export function getAdminEmails(): string[] {
  const env = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BUILTIN_ADMINS.map((e) => e.toLowerCase()), ...env]));
}

export function isSuperadmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
