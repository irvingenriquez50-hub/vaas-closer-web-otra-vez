import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) redirect("/pending");

  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  const { data: sessions } = await supabase.from("bot_sessions").select("*");
  const { data: channels } = await supabase.from("whatsapp_channels").select("*");
  const { data: leads } = await supabase.from("leads").select("user_id,status,paused");
  const { data: dealsThisMonth } = await supabase
    .from("closed_deals")
    .select("user_id,price,videos,closed_at")
    .gte("closed_at", monthStart());

  return (
    <AdminClient
      users={users || []}
      sessions={sessions || []}
      channels={channels || []}
      leads={leads || []}
      dealsThisMonth={dealsThisMonth || []}
    />
  );
}
