"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const D360_BASE_URL = "https://waba-v2.360dialog.io";

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

// Configura el webhook automáticamente en 360dialog usando la API key recién
// guardada — así ya no hay que ir a 360dialog a pegarlo a mano cada vez.
async function configureWebhookOn360dialog(apiKey, userId) {
  const webhookUrl = `${process.env.BOT_ENGINE_URL}/webhook/${userId}`;
  try {
    const res = await fetch(`${D360_BASE_URL}/v1/configs/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": apiKey,
      },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`No se pudo configurar el webhook en 360dialog para ${userId}:`, data);
      return { ok: false, error: data?.meta?.developer_message || `Error ${res.status}` };
    }
    console.log(`✅ Webhook configurado en 360dialog para ${userId}: ${webhookUrl}`);
    return { ok: true };
  } catch (err) {
    console.error(`Error de red configurando webhook para ${userId}:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Guarda (o actualiza) la API key de 360dialog y el número de un miembro,
// y configura su webhook automáticamente en el mismo paso.
export async function saveWhatsappChannel(userId, apiKey, phoneNumber) {
  const supabase = await requireAdmin();
  const cleanApiKey = apiKey.trim();
  const cleanPhone = phoneNumber.trim();

  const { error } = await supabase.from("whatsapp_channels").upsert({
    user_id: userId,
    d360_api_key: cleanApiKey,
    phone_number: cleanPhone,
  });
  if (error) {
    console.error("Error guardando whatsapp_channel:", error);
    return { error: error.message };
  }

  const webhookResult = await configureWebhookOn360dialog(cleanApiKey, userId);

  revalidatePath("/admin");

  if (!webhookResult.ok) {
    return {
      ok: true,
      warning: `Se guardó el número, pero no se pudo configurar el webhook automáticamente (${webhookResult.error}). Puede que necesites configurarlo a mano en 360dialog esta vez.`,
    };
  }
  return { ok: true };
}
