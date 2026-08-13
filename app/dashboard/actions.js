"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function resolveTargetUserId(requestedId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Only allow operating on someone else's data if the caller is the admin —
  // enforced again at the database level by RLS regardless of what happens here.
  if (requestedId && requestedId !== user.id) {
    if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) throw new Error("No autorizado");
    return requestedId;
  }
  return user.id;
}

export async function saveScript(targetUserId, message1) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  await supabase.from("scripts").upsert({ user_id: userId, message1 });
  revalidatePath("/dashboard");
}

export async function savePricing(targetUserId, tiers) {
  const userId = await resolveTargetUserId(targetUserId);
  const supabase = createClient();
  const rows = tiers.map((t) => ({
    user_id: userId,
    videos: t.videos,
    anchor: t.anchor,
    floor: t.floor,
  }));
  await supabase.from("pricing_tiers").upsert(rows, { onConflict: "user_id,videos" });
  revalidatePath("/dashboard");
}

export async function addLead(targetUserId, phoneRaw, skipMessage1 = false) {
  const userId = await resolveTargetUserId(targetUserId);
  if (!phoneRaw?.trim()) return { error: "Número inválido." };

  const res = await fetch(`${process.env.BOT_ENGINE_URL}/add-lead/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: phoneRaw, skipMessage1 }),
  });
  const data = await res.json();
  if (!data.ok) return { error: data.error || "No se pudo agregar el número." };
  revalidatePath("/dashboard");
  return { ok: true };
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
