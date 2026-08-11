import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("status,expires_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "active") redirect("/dashboard");

  const isExpired = profile?.status === "expired";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{ background: "#0B0E14" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "#141B24", border: "1px solid #232D3A" }}
      >
        <div className="f-display" style={{ fontWeight: 700, fontSize: 20, marginBottom: 10 }}>
          {isExpired ? "Tu acceso venció" : "Cuenta en revisión"}
        </div>
        <div style={{ fontSize: 13.5, color: "#8B96A5", lineHeight: 1.5 }}>
          {isExpired
            ? "Tus 30 días de acceso al bot terminaron. Contacta a Irving para renovar."
            : "Tu cuenta ya quedó registrada. En cuanto se apruebe tu acceso, vas a poder entrar aquí mismo."}
        </div>
      </div>
    </div>
  );
}
