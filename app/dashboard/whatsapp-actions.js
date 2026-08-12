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

export async function connectWhatsapp(targetUserId) {
  const userId = await resolveTargetUserId(targetUserId);
  const res = await fetch(`${process.env.BOT_ENGINE_URL}/connect/${userId}`, { method: "POST" });
  return res.json();
}

export async function whatsappStatus(targetUserId) {
  const userId = await resolveTargetUserId(targetUserId);
  const res = await fetch(`${process.env.BOT_ENGINE_URL}/status/${userId}`, { cache: "no-store" });
  return res.json();
}
