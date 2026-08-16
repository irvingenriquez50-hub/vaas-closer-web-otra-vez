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

function rangeToSince(range) {
  const now = new Date();
  const map = {
    "1d": 1,
    "2d": 2,
    "3d": 3,
    "7d": 7,
    "30d": 30,
    "60d": 60,
    "90d": 90,
    "120d": 120,
    "150d": 150,
  };
  const days = map[range] || 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function importFromDiscord(targetUserId, range) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();

  const since = rangeToSince(range);
  const until = new Date();

  const url = `${process.env.DISCORD_BOT_URL}/contacts?channelId=${process.env.DISCORD_CHANNEL_ID}&since=${since.toISOString()}&until=${until.toISOString()}`;

  const res = await fetch(url, {
    headers: { "x-import-secret": process.env.BOT_IMPORT_SECRET },
  });
  const data = await res.json();
  if (!data.ok) return { error: data.error || "No se pudo conectar con Discord." };

  if (!data.contacts.length) {
    return { ok: true, imported: 0 };
  }

  // Revisa cuáles de estos contactos YA existen en la lista de este miembro,
  // para no duplicarlos — sin bloquear rangos más grandes en el futuro.
  const { data: existing } = await supabase
    .from("lead_requests")
    .select("discord_message_id")
    .eq("user_id", userId);
  const existingIds = new Set((existing || []).map((r) => r.discord_message_id));

  const newContacts = data.contacts.filter((c) => !existingIds.has(c.discord_message_key));
  if (!newContacts.length) return { ok: true, imported: 0 };

  // Revisa colaboración cruzada para cada contacto antes de insertarlo.
  const { data: allLeads } = await supabase.from("leads").select("user_id,phone").neq("user_id", userId);

  const rows = newContacts.map((c) => {
    const digits = c.phone.replace(/[^0-9]/g, "");
    const cross = (allLeads || []).some((l) => {
      const leadDigits = (l.phone || "").replace(/[^0-9]/g, "");
      return leadDigits && digits.slice(-8) === leadDigits.slice(-8);
    });
    return {
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
  });

  const { error } = await supabase.from("lead_requests").insert(rows);
  if (error) {
    console.error("Error guardando lead_requests:", error);
    return { error: error.message };
  }

  return { ok: true, imported: rows.length };
}

export async function listLeadRequests(targetUserId) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  const { data } = await supabase
    .from("lead_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("message_created_at", { ascending: false });
  return data || [];
}

export async function activateLeadRequest(targetUserId, requestId, phone) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();

  const res = await fetch(`${process.env.BOT_ENGINE_URL}/add-lead/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, skipMessage1: true }),
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
