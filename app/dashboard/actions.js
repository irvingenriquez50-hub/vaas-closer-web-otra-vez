"use server";
import {engineRequest} from "@/lib/engine";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

const digitsOf = (s) => (s || "").replace(/[^0-9]/g, "");

/** Busca un lead de este usuario por número, comparando solo los últimos 8 dígitos
 * — así da igual si está guardado como "+86 135 7603 8204" o "8613576038204". */
async function findLeadByPhone(supabase, userId, phoneRaw) {
  const digits = digitsOf(phoneRaw);
  if (digits.length < 7) return null;
  const { data } = await supabase.from("leads").select("*").eq("user_id", userId);
  return (data || []).find((l) => digitsOf(l.phone) === digits) || null;
}

export async function saveScript(targetUserId, fields) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  const {error}=await supabase.from("scripts").upsert({
    user_id: userId,
    gmv_total: fields.gmvTotal || "",
    market: fields.market || "",
    short_name: fields.shortName || "",
    gmv_30d: fields.gmv30d || "",
    tiktok_handle: fields.tiktokHandle || "",
  });
  if(error) throw new Error("No se pudo guardar tu perfil.");
  revalidatePath("/dashboard");
}

export async function savePricing(targetUserId, tiers) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  if(!Array.isArray(tiers) || tiers.some(t=>!Number.isInteger(Number(t.videos)) || Number(t.videos)<=0 || !Number.isFinite(Number(t.anchor)) || !Number.isFinite(Number(t.floor)) || Number(t.floor)<=0 || Number(t.anchor)<Number(t.floor) || (t.medio!=null && (!Number.isFinite(Number(t.medio)) || Number(t.medio)<Number(t.floor) || Number(t.medio)>Number(t.anchor))))) throw new Error("Revisa tus precios: mínimo mayor que cero y menor o igual al precio inicial.");
  const rows = tiers.map((t) => ({
    user_id: userId,
    videos: t.videos,
    anchor: t.anchor,
    medio: t.medio ?? null,
    floor: t.floor,
  }));
  const {error}=await supabase.from("pricing_tiers").upsert(rows, { onConflict: "user_id,videos" });
  if(error) throw new Error("No se pudieron guardar tus precios.");
  revalidatePath("/dashboard");
}

export async function addLead(targetUserId, phoneRaw, skipMessage1 = false) {
  const userId = await resolveTargetUserId(targetUserId);
  if (!phoneRaw?.trim()) return { error: "Número inválido." };

  // PROTECCIÓN: si ya marcaste que tienes colaboración con este número, no se
  // manda NADA. Puede ser el mismo contacto para otro producto, así que no se
  // bloquea a la brava — se te avisa y tú decides revisándolo en WhatsApp.
  const supabase = createClient();
  const existing = await findLeadByPhone(supabase, userId, phoneRaw);
  if (existing?.negotiation?.manualCollab) {
    return {
      error:
        "Ya marcaste que tienes colaboración con este número — no se mandó nada. Si es para otro producto, revísalo en WhatsApp y escríbele tú a mano.",
    };
  }

  let data;
  try {data=await engineRequest('/add-lead/'+userId,{method:'POST',body:{phone:phoneRaw,skipMessage1}});}
  catch(e){return {error:e.message};}
  if (!data.ok) return { error: data.error || "No se pudo agregar el número." };
  revalidatePath("/dashboard");
  return { ok: true, lead: data.lead };
}

/** "Ya tengo colaboración con este número."
 *
 * Deja el contacto CERRADO y PAUSADO, con una marca que dice que fue una
 * colaboración que ya tenías por tu cuenta (no un trato cerrado por el bot).
 * Efecto: el bot nunca le escribe, ni ahora ni si el número vuelve a caer en la
 * lista. NO se reporta nada al Retainer Tracker.
 *
 * Sirve para las dos situaciones:
 *   - el número ya está en tu cola  -> se convierte, sin borrar su historial
 *   - el número nunca ha estado ahí -> se registra desde cero, sin mandar nada
 */
export async function markAsCollab(targetUserId, phoneRaw) {
  const userId = await resolveTargetUserId(targetUserId);
  const digits = digitsOf(phoneRaw);
  if (digits.length < 7) return { error: "Número inválido." };

  const supabase = createClient();
  const existing = await findLeadByPhone(supabase, userId, phoneRaw);

  if (existing) {
    const { error } = await supabase
      .from("leads")
      .update({
        status: "cerrado",
        paused: true,
        negotiation: { ...(existing.negotiation || {}), manualCollab: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { ok: true, updated: true, phone: existing.phone };
  }

  const { error } = await supabase.from("leads").insert({
    user_id: userId,
    phone: phoneRaw.trim(),
    jid: digits,
    status: "cerrado",
    paused: true,
    negotiation: { manualCollab: true },
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true, created: true, phone: phoneRaw.trim() };
}

export async function updateLeadStatus(targetUserId, leadId, status) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", leadId).eq("user_id", userId);
  revalidatePath("/dashboard");
}

export async function toggleLeadPause(targetUserId, leadId, paused) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase.from("leads").update({ paused, updated_at: new Date().toISOString() }).eq("id", leadId).eq("user_id", userId);
  revalidatePath("/dashboard");
}

export async function removeLead(targetUserId, leadId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase.from("leads").delete().eq("id", leadId).eq("user_id", userId);
  revalidatePath("/dashboard");
}

// Para leads "cruzado" donde nunca se cerró nada: reinicia el proceso desde cero.
// El bot manda el escrito principal otra vez en el próximo chequeo automático.
export async function restartLead(targetUserId, leadId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase
    .from("leads")
    .update({ status: "nuevo", paused: false, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", userId);
  revalidatePath("/dashboard");
}

// Para leads "cruzado" donde SÍ hubo un deal (por fuera del bot, o ya resuelto):
// lo archiva localmente, sin reportarlo al Retainer Tracker ni duplicar nada.
export async function resolveLeadManually(targetUserId, leadId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase
    .from("leads")
    .update({ status: "cerrado", paused: true, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", userId);
  revalidatePath("/dashboard");
}
