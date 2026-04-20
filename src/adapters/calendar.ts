/**
 * Календарь — пока заглушка. Интеграции: Google Calendar, Яндекс.Календарь, Bitrix24.
 * После подключения — реализуй createEvent через OAuth-токен компании.
 */
export async function createCalendarEvent(params: {
  title: string;
  datetime: string;
  duration_minutes?: number;
  attendees?: string[];
  notes?: string;
}) {
  return {
    ok: true,
    event_id: `mock-${Date.now()}`,
    link: `https://telemost.yandex.ru/j/${Math.random().toString(36).slice(2, 14)}`,
    ...params,
  };
}
