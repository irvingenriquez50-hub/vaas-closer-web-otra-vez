import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const targetUserId = isAdmin && searchParams?.as ? searchParams.as : user.id;
  const isAdminView = isAdmin && targetUserId !== user.id;

  if (!isAdmin) {
    const { data: profile } = await supabase.from("users").select("status").eq("id", user.id).maybeSingle();
    if (!profile || profile.status !== "active") redirect("/pending");
  }

  const [{ data: profile }, { data: tiers }, { data: script }, { data: leads }] = await Promise.all([
    supabase.from("users").select("id,name,email,status,expires_at").eq("id", targetUserId).maybeSingle(),
    supabase.from("pricing_tiers").select("*").eq("user_id", targetUserId),
    supabase.from("scripts").select("*").eq("user_id", targetUserId).maybeSingle(),
    supabase.from("leads").select("*").eq("user_id", targetUserId).order("updated_at", { ascending: false }),
  ]);

  return (
    <DashboardClient
      targetUserId={targetUserId}
      isAdminView={isAdminView}
      profile={profile}
      initialTiers={tiers || []}
      initialScript={{
        gmvTotal: script?.gmv_total || "",
        market: script?.market || "Spanish-speaking",
        shortName: script?.short_name || "",
        gmv30d: script?.gmv_30d || "",
        tiktokHandle: script?.tiktok_handle || "",
      }}
      initialLeads={leads || []}
    />
  );
}
