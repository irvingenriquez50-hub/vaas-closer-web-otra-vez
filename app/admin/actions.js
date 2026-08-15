"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) throw new Error("No autorizado");
  return supabase;
}

export async function approveUser(userId) {
  const supabase = await requireAdmin();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await supabase
    .from("users")
    .update({ status: "active", approved_at: now.toISOString(), expires_at: expires.toISOString() })
    .eq("id", userId);
  revalidatePath("/admin");
}

export async function renewUser(userId) {
  const supabase = await requireAdmin();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await supabase
    .from("users")
    .update({ status: "active", expires_at: expires.toISOString() })
    .eq("id", userId);
  revalidatePath("/admin");
}

export async function deactivateUser(userId) {
  const supabase = await requireAdmin();
  await supabase.from("users").update({ status: "expired" }).eq("id", userId);
  revalidatePath("/admin");
}

export async function saveAdminNote(userId, notes) {
  const supabase = await requireAdmin();
  await supabase.from("users").update({ notes }).eq("id", userId);
  revalidatePath("/admin");
}

// Guarda (o actualiza) la API key de 360dialog y el número de un miembro —
// esto es lo único que hace falta para que su WhatsApp quede activo, sin tocar SQL.
export async function saveWhatsappChannel(userId, apiKey, phoneNumber) {
  const supabase = await requireAdmin();
  await supabase.from("whatsapp_channels").upsert({
    user_id: userId,
    d360_api_key: apiKey.trim(),
    phone_number: phoneNumber.trim(),
  });
  revalidatePath("/admin");
}
