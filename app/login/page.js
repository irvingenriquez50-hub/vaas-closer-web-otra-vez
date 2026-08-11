"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{ background: "#0B0E14" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "#141B24", border: "1px solid #232D3A" }}
      >
        <div
          className="f-display"
          style={{ fontWeight: 700, fontSize: 24, color: "#EDEFF2", marginBottom: 6 }}
        >
          VAAS Closer Bot
        </div>
        <div style={{ fontSize: 13, color: "#8B96A5", marginBottom: 28 }}>
          Acceso privado — solo miembros aprobados
        </div>
        <button
          onClick={signIn}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: "#22D3C0", color: "#06110F" }}
        >
          Entrar con Google
        </button>
      </div>
    </div>
  );
}
