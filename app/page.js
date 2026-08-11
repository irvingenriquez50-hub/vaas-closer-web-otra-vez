import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) redirect("/admin");

  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") redirect("/pending");

  redirect("/dashboard");
}
