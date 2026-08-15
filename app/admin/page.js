import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

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

  return <AdminClient users={users || []} sessions={sessions || []} channels={channels || []} />;
}
