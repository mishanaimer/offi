import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { generateMascotConfig } from "@/lib/mascot/generate";

const PLATFORM_COMPANY_NAME = "Offi";
const PLATFORM_ASSISTANT_NAME = "Оффи";
const PLATFORM_ACCENT = "#0259DD";

/**
 * Идемпотентно привязывает супер-админа к фирменной компании «Offi» с ассистентом «Оффи».
 * Не трогает пользователей, у которых уже есть company_id — чтобы не переписать их привязку.
 *
 * Цель: ngig45@yandex.ru / gign230102@gmail.com при первом заходе сразу попадают в
 * брендовую компанию Offi, без онбординга.
 */
export async function ensureAdminPlatformCompany(userId: string, email: string) {
  if (!email) return;
  const service = createServiceClient();

  const { data: userRow } = await service
    .from("users")
    .select("id, company_id, companies:companies(id, name)")
    .eq("id", userId)
    .maybeSingle();

  // уже привязан к какой-то компании — ничего не делаем
  if (userRow?.company_id) return;

  // Ищем существующую платформенную компанию
  const { data: existingCompany } = await service
    .from("companies")
    .select("id")
    .eq("name", PLATFORM_COMPANY_NAME)
    .eq("assistant_name", PLATFORM_ASSISTANT_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let companyId = existingCompany?.id ?? null;

  if (!companyId) {
    const mascot = generateMascotConfig({
      companyName: PLATFORM_COMPANY_NAME,
      accentColor: PLATFORM_ACCENT,
    });
    const { data: created } = await service
      .from("companies")
      .insert({
        name: PLATFORM_COMPANY_NAME,
        assistant_name: PLATFORM_ASSISTANT_NAME,
        brand_accent: PLATFORM_ACCENT,
        assistant_color: PLATFORM_ACCENT,
        plan: "team",
        mascot_enabled: true,
        mascot_head_shape: mascot.headShape,
        mascot_antenna: mascot.antenna,
        mascot_ears: mascot.ears,
        mascot_bg: mascot.bg,
      })
      .select("id")
      .single();
    companyId = created?.id ?? null;
  }

  if (!companyId) return;

  await service.from("users").update({ company_id: companyId, role: "owner" }).eq("id", userId);

  // Убедимся, что есть хотя бы один AI-канал — иначе первые сообщения не сохранятся.
  const { data: anyChan } = await service
    .from("channels")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "ai")
    .limit(1)
    .maybeSingle();
  if (!anyChan) {
    await service.from("channels").insert({
      company_id: companyId,
      name: "Основной чат",
      type: "ai",
      created_by: userId,
    });
  }
}
