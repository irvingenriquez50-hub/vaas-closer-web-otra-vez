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

  const { data: lastImport } = await supabase
    .from("discord_import_log")
    .select("imported_until")
    .eq("user_id", userId)
    .order("imported_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  const requestedSince = rangeToSince(range);
  const effectiveSince =
    lastImport?.imported_until && new Date(lastImport.imported_until) > requestedSince
      ? new Date(lastImport.imported_until)
      : requestedSince;

  const until = new Date();

  const url = `${process.env.DISCORD_BOT_URL}/contacts?channelId=${process.env.DISCORD_CHANNEL_ID}&since=${effectiveSince.toISOString()}&until=${until.toISOString()}`;

  const res = await fetch(url, {
    headers: { "x-import-secret": process.env.BOT_IMPORT_SECRET },
  });
  const data = await res.json();
  if (!data.ok) return { error: data.error || "No se pudo conectar con Discord." };

  if (!data.contacts.length) {
    await supabase.from("discord_import_log").insert({ user_id: userId, imported_until: until.toISOString() });
    return { ok: true, imported: 0 };
  }

  const { data: allLeads } = await supabase.from("leads").select("user_id,phone").neq("user_id", userId);

  const rows = data.contacts.map((c) => {
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
      cross_member: cross,
      status: "pending",
    };
  });

  const { error } = await supabase
    .from("lead_requests")
    .upsert(rows, { onConflict: "user_id,discord_message_id", ignoreDuplicates: true });

  if (error) {
    console.error("Error guardando lead_requests:", error);
    return { error: error.message };
  }

  await supabase.from("discord_import_log").insert({ user_id: userId, imported_until: until.toISOString() });

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
    .order("created_at", { ascending: false });
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
