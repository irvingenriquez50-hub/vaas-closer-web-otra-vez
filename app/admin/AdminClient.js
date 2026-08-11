"use client";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveUser, renewUser, deactivateUser } from "./actions";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export default function AdminClient({ users, sessions }) {
  const [tab, setTab] = useState("pendientes");
  const [pending, startTransition] = useTransition();

  const sessionFor = (userId) => sessions.find((s) => s.user_id === userId);

  const pendientes = users.filter((u) => u.status === "pending");
  const activos = users.filter((u) => u.status === "active");
  const vencidos = users.filter((u) => u.status === "expired");

  const F_DISPLAY = "'Space Grotesk', sans-serif";

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const list = tab === "pendientes" ? pendientes : tab === "activos" ? activos : vencidos;

  return (
    <div className="min-h-screen w-full pb-16" style={{ background: "#0B0E14", color: "#EDEFF2" }}>
      <div className="px-5 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1B2430" }}>
        <h1 style={{ fontFamily: F_DISPLAY, fontWeight: 700, fontSize: 22 }}>Admin — VAAS Closer Bot</h1>
        <button onClick={signOut} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5" }}>
          Salir
        </button>
      </div>

      <div className="px-5 pt-4 flex gap-2">
        {[
          ["pendientes", `Solicitudes (${pendientes.length})`],
          ["activos", `Activos (${activos.length})`],
          ["vencidos", `Vencidos (${vencidos.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={tab === key ? { background: "#22D3C0", color: "#06110F" } : { background: "#141B24", color: "#8B96A5", border: "1px solid #232D3A" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 flex flex-col gap-3">
        {list.length === 0 && (
          <div className="text-sm text-center py-10" style={{ color: "#8B96A5" }}>
            Nada por aquí.
          </div>
        )}
        {list.map((u) => {
          const session = sessionFor(u.id);
          const dLeft = daysLeft(u.expires_at);
          return (
            <div key={u.id} className="rounded-xl p-4" style={{ background: "#141B24", border: "1px solid #232D3A" }}>
              <div className="flex items-start justify-between">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name || "(sin nombre)"}</div>
                  <div style={{ fontSize: 12, color: "#8B96A5" }}>{u.email}</div>
                  {tab === "activos" && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: session?.connected ? "#34D399" : "#F19999" }}
                      />
                      <span style={{ fontSize: 11, color: "#8B96A5" }}>
                        {session?.connected ? "WhatsApp conectado" : "WhatsApp no conectado"} · {dLeft != null ? `${dLeft} días restantes` : ""}
                      </span>
                    </div>
                  )}
                  {tab === "vencidos" && (
                    <div style={{ fontSize: 11, color: "#8B96A5", marginTop: 4 }}>
                      Venció: {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : "—"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  {tab === "pendientes" && (
                    <button
                      onClick={() => startTransition(() => approveUser(u.id))}
                      disabled={pending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "#22D3C0", color: "#06110F" }}
                    >
                      Aprobar (30 días)
                    </button>
                  )}
                  {tab === "activos" && (
                    <>
                      <a
                        href={`/dashboard?as=${u.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-center"
                        style={{ background: "#1B2430", color: "#EDEFF2" }}
                      >
                        Ver como →
                      </a>
                      <button
                        onClick={() => startTransition(() => deactivateUser(u.id))}
                        disabled={pending}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: "#2A1620", color: "#F19999" }}
                      >
                        Quitar acceso
                      </button>
                    </>
                  )}
                  {tab === "vencidos" && (
                    <button
                      onClick={() => startTransition(() => renewUser(u.id))}
                      disabled={pending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "#22D3C0", color: "#06110F" }}
                    >
                      Renovar 30 días
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
