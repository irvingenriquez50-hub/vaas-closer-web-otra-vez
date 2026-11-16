"use server";
import {engineRequest} from "@/lib/engine";
import { createClient } from "@/lib/supabase/server";

async function resolveTargetUserId(requestedId) {
  const { userId } = await resolveContext(requestedId);
  return userId;
}

/** Igual que resolveTargetUserId, pero además dice si QUIEN ESTÁ VIENDO es el
 * admin — no de quién es la cuenta. Se usa para el historial profundo del
 * calendario, que solo el admin puede pedir. */
async function resolveContext(requestedId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (requestedId && requestedId !== user.id) {
    if (!isAdmin) throw new Error("No autorizado");
    return { userId: requestedId, isAdmin };
  }
  return { userId: user.id, isAdmin };
}

const digitsOf = (s) => (s || "").replace(/[^0-9]/g, "");
const DIA_MS = 24 * 60 * 60 * 1000;

// CUÁNTO HISTORIAL VE CADA QUIEN — el número que manda, y está del lado del
// servidor a propósito: aunque alguien manipule la página, aquí se recorta.
//   Miembro: 30 días, fijo. No hay forma de pedir más.
//   Admin:   hasta 400 días, para poder retomar contactos viejos.
const MEMBER_DAYS = 60;
const ADMIN_MAX_DAYS = 400;

export async function getDiscordCalendar(targetUserId, days = MEMBER_DAYS) {
  const { isAdmin } = await resolveContext(targetUserId);
  const safeDays = isAdmin ? Math.min(Math.max(Number(days) || MEMBER_DAYS, 1), ADMIN_MAX_DAYS) : MEMBER_DAYS;
  const since = new Date(Date.now() - safeDays * DIA_MS);
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
  const { userId, isAdmin } = await resolveContext(targetUserId);

  // SEGUNDO CANDADO. No basta con esconder los días viejos del calendario: sin
  // esto, un miembro podría pedir un día de hace 6 meses directamente y el
  // servidor se lo daría. Aquí se rechaza cualquier día fuera de su ventana.
  if (!isAdmin) {
    const diaMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    if (isNaN(diaMs) || diaMs < Date.now() - MEMBER_DAYS * DIA_MS) {
      return { error: `Ese día ya está fuera de tu ventana de ${MEMBER_DAYS} días.` };
    }
  }

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



  let count = 0;
  for (const c of data.contacts) {
    const currentStatus = existingMap.get(c.discord_message_key);
    // Protegidos para siempre: activated, ongoing, o ya visible como pending.
    if (currentStatus === "activated" || currentStatus === "ongoing" || currentStatus === "pending") continue;

    const digits = c.phone.replace(/[^0-9]/g, "");


    const row = {
      user_id: userId,
      discord_message_id: c.discord_message_key,
      phone: c.phone,
      product: c.product,
      videos_text: c.videos_text,
      price_text: c.price_text,
      message_created_at: c.created_at,
      cross_member: false,
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

/** Busca si ESTE usuario ya tiene historial con un número: un chat en el bot
 * (tabla leads) o un trato cerrado (tabla closed_deals). Solo LEE — no cambia
 * nada. Devuelve un resumen en palabras para enseñárselo a Irving. */
async function findExistingHistory(supabase, userId, phone) {
  const tail = digitsOf(phone);
  if (!tail || tail.length < 7) return null;

  const [{ data: myLeads }, { data: myClosed }] = await Promise.all([
    supabase.from("leads").select("id,phone,status,conversation,last_inbound_at").eq("user_id", userId),
    supabase.from("closed_deals").select("phone,price,videos,closed_at").eq("user_id", userId),
  ]);

  const lead = (myLeads || []).find((l) => digitsOf(l.phone) === tail);
  const closed = (myClosed || []).find((c) => digitsOf(c.phone) === tail);
  if (!lead && !closed) return null;

  const parts = [];
  if (closed) {
    const fecha = closed.closed_at ? new Date(closed.closed_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "";
    parts.push(`🤝 TRATO CERRADO${fecha ? ` el ${fecha}` : ""} — $${closed.price} por ${closed.videos} videos.`);
  }
  if (lead) {
    const msgs = Array.isArray(lead.conversation) ? lead.conversation.length : 0;
    const contestaron = Array.isArray(lead.conversation) && lead.conversation.some((m) => m.role === "user");
    parts.push(`💬 Chat en el bot: estado "${lead.status}", ${msgs} mensaje${msgs === 1 ? "" : "s"}, ${contestaron ? "la marca SÍ ha contestado" : "la marca nunca contestó"}.`);
  }
  return { summary: parts.join("\n"), leadId: lead?.id || null, leadStatus: lead?.status || null };
}

// skipMessage1 refleja si el usuario ya mandó el mensaje 1 a mano desde su teléfono
// (checkbox "Ya le mandé el mensaje" en la tarjeta) — si NO lo marcó, el bot debe
// mandar el template de apertura automáticamente, igual que en "Cola de contactos".
//
// PROTECCIÓN NUEVA: antes de activar, se revisa si ya hay historial con ese número
// (chat del bot o trato cerrado). Si lo hay y no vino "force", NO se hace nada y
// se regresa el detalle para que Irving decida. Con force=true, el lead existente
// se REINICIA (status nuevo o esperando) en vez de crear uno duplicado — el chat
// guardado NO se borra, solo se le da otra vuelta.
export async function activateLeadRequest(targetUserId) {
 await resolveTargetUserId(targetUserId);
 return {error:'Usa la nueva sección Contactos para revisar y poner este número en cola.'};
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
export async function resetDayRequests(targetUserId) {
 await resolveTargetUserId(targetUserId);
 return {error:'Los historiales se conservan. Revisa cada contacto desde Contactos para volver a escribir.'};
}
