"use server";
import { createClient } from "@/lib/supabase/server";

async function resolveTargetUserId(requestedId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  if (requestedId && requestedId !== user.id) {
    if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) throw new Error("No autorizado");
    return requestedId;
  }
  return user.id;
}

export async function getDiscordCalendar(targetUserId) {
  await resolveTargetUserId(targetUserId);
  const since = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
  const until = new Date();

  const url = `${process.env.DISCORD_BOT_URL}/contacts-summary?channelId=${process.env.DISCORD_CHANNEL_ID}&since=${since.toISOString()}&until=${until.toISOString()}`;
  const res = await fetch(url, { headers: { "x-import-secret": process.env.BOT_IMPORT_SECRET } });
  const data = await res.json();
  if (!data.ok) return [];
  return data.summary;
}

// Importa (o re-importa) los contactos de UN día específico. Si algún
// contacto ya estaba "rejected", lo regresa a "pending" — se puede recuperar.
// Los que ya están "activated" u "ongoing" NUNCA se tocan ni regresan.
export async function importDay(targetUserId, dateStr) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();

  const since = new Date(`${dateStr}T00:00:00.000Z`);
  const until = new Date(`${dateStr}T23:59:59.999Z`);

  const url = `${process.env.DISCORD_BOT_URL}/contacts?channelId=${process.env.DISCORD_CHANNEL_ID}&since=${since.toISOString()}&until=${until.toISOString()}`;
  const res = await fetch(url, { headers: { "x-import-secret": process.env.BOT_IMPORT_SECRET } });
  const data = await res.json();
  if (!data.ok) return { error: data.error || "No se pudo conectar con Discord." };
  if (!data.contacts.length) return { ok: true, imported: 0 };

  const { data: existingRows } = await supabase
    .from("lead_requests")
    .select("discord_message_id,status")
    .eq("user_id", userId);
  const existingMap = new Map((existingRows || []).map((r) => [r.discord_message_id, r.status]));

  const { data: allLeads } = await supabase.from("leads").select("user_id,phone").neq("user_id", userId);

  let count = 0;
  for (const c of data.contacts) {
    const currentStatus = existingMap.get(c.discord_message_key);
    // Protegidos para siempre: activated, ongoing, o ya visible como pending.
    if (currentStatus === "activated" || currentStatus === "ongoing" || currentStatus === "pending") continue;

    const digits = c.phone.replace(/[^0-9]/g, "");
    const cross = (allLeads || []).some((l) => {
      const leadDigits = (l.phone || "").replace(/[^0-9]/g, "");
      return leadDigits && digits.slice(-8) === leadDigits.slice(-8);
    });

    const row = {
      user_id: userId,
      discord_message_id: c.discord_message_key,
      phone: c.phone,
      product: c.product,
      videos_text: c.videos_text,
      price_text: c.price_text,
      message_created_at: c.created_at,
      cross_member: cross,
      status: "pending",
    };

    await supabase.from("lead_requests").upsert(row, { onConflict: "user_id,discord_message_id" });
    count += 1;
  }

  return { ok: true, imported: count };
}

/** Regresa, por cada día, cuántos contactos se importaron y cuántos siguen
 * pendientes de revisar. Sirve para pintar el calendario:
 *   - día sin datos      -> todavía no se importa (sin color)
 *   - pendientes > 0     -> falta trabajarlo (rojo)
 *   - pendientes === 0   -> ya quedó todo procesado (verde) */
export async function getDayStatuses(targetUserId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  const { data } = await supabase
    .from("lead_requests")
    .select("message_created_at,status")
    .eq("user_id", userId);

  const byDay = {};
  for (const r of data || []) {
    if (!r.message_created_at) continue;
    const day = new Date(r.message_created_at).toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, pending: 0 };
    byDay[day].total += 1;
    if (r.status === "pending") byDay[day].pending += 1;
  }
  return byDay;
}

export async function listLeadRequests(targetUserId) {  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  const { data } = await supabase
    .from("lead_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("message_created_at", { ascending: false });
  return data || [];
}

// skipMessage1 refleja si el usuario ya mandó el mensaje 1 a mano desde su teléfono
// (checkbox "Ya le mandé el mensaje" en la tarjeta) — si NO lo marcó, el bot debe
// mandar el template de apertura automáticamente, igual que en "Cola de contactos".
export async function activateLeadRequest(targetUserId, requestId, phone, skipMessage1 = true) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();

  const res = await fetch(`${process.env.BOT_ENGINE_URL}/add-lead/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, skipMessage1 }),
  });
  const data = await res.json();
  if (!data.ok) return { error: data.error || "No se pudo activar el contacto." };

  await supabase.from("lead_requests").update({ status: "activated" }).eq("id", requestId).eq("user_id", userId);
  return { ok: true };
}

export async function rejectLeadRequest(targetUserId, requestId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase.from("lead_requests").update({ status: "rejected" }).eq("id", requestId).eq("user_id", userId);
  return { ok: true };
}

// Marca un contacto como "ya tengo colaboración con esta persona" — queda
// protegido para siempre, nunca vuelve a aparecer aunque se reimporte ese día.
export async function markOngoingRequest(targetUserId, requestId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase.from("lead_requests").update({ status: "ongoing" }).eq("id", requestId).eq("user_id", userId);
  return { ok: true };
}

// Resetea TODOS los contactos "activated" de un día específico, para que vuelvan
// a aparecer en la lista de pendientes y se pueda mandar el mensaje 1 otra vez.
// SEGURIDAD: antes de tocar cada contacto, revisa el chat guardado — si la marca
// ya contestó algo (conversación real) o el trato ya se cerró, lo PROTEGE y no lo
// toca. Solo resetea los que se quedaron atorados sin ninguna respuesta real.
// Aislado por cuenta: solo afecta los contactos del usuario que lo ejecuta.
export async function resetDayRequests(targetUserId, dateStr) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();

  const since = new Date(`${dateStr}T00:00:00.000Z`);
  const until = new Date(`${dateStr}T23:59:59.999Z`);

  const { data: dayRequests } = await supabase
    .from("lead_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "activated")
    .gte("message_created_at", since.toISOString())
    .lte("message_created_at", until.toISOString());

  if (!dayRequests || !dayRequests.length) return { ok: true, reset: 0, protected: 0 };

  const { data: myLeads } = await supabase.from("leads").select("*").eq("user_id", userId);

  let resetCount = 0;
  let protectedCount = 0;

  for (const req of dayRequests) {
    const digits = (req.phone || "").replace(/[^0-9]/g, "");
    const matchedLead = (myLeads || []).find(
      (l) => (l.phone || "").replace(/[^0-9]/g, "").slice(-8) === digits.slice(-8)
    );

    const hasRealReply = matchedLead?.conversation?.some((m) => m.role === "user");
    const isClosed = matchedLead?.status === "cerrado";

    if (matchedLead && (hasRealReply || isClosed)) {
      protectedCount += 1;
      continue; // conversación real o trato cerrado — nunca se toca
    }

    if (matchedLead) {
      await supabase.from("leads").delete().eq("id", matchedLead.id).eq("user_id", userId);
    }
    await supabase.from("lead_requests").update({ status: "pending" }).eq("id", req.id).eq("user_id", userId);
    resetCount += 1;
  }

  return { ok: true, reset: resetCount, protected: protectedCount };
}
