"use client";
import { useState, useTransition } from "react";
import SystemControls from "./SystemControls";
import { createClient } from "@/lib/supabase/client";
import { approveUser, renewUser, deactivateUser } from "./actions";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function computeStats(userId, leads, dealsThisMonth) {
  const userLeads = leads.filter((l) => l.user_id === userId);
  const activeLeads = userLeads.filter(
    (l) => !["cerrado", "dormant", "cruzado"].includes(l.status) && !l.paused
  ).length;
  const negociando = userLeads.filter((l) => l.status === "negociando").length;

  const userDeals = dealsThisMonth.filter((d) => d.user_id === userId);
  const dealsCount = userDeals.length;
  const revenue = userDeals.reduce((sum, d) => sum + Number(d.price || 0), 0);

  return { activeLeads, negociando, dealsCount, revenue };
}

export default function AdminClient({ users, leads, dealsThisMonth }) {
  const [tab, setTab] = useState("activos");
  const [system, setSystem] = useState(null);
  const [pending, startTransition] = useTransition();

  const channelFor = (userId) => system?.channels?.find((c) => c.user_id === userId);

  const pendientes = users.filter((u) => u.status === "pending");
  const activos = users.filter((u) => u.status === "active");
  const vencidos = users.filter((u) => u.status === "expired");

  const F_DISPLAY = "'Space Grotesk', sans-serif";
  const F_MONO = "'IBM Plex Mono', monospace";

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const list = tab === "pendientes" ? pendientes : tab === "activos" ? activos : vencidos;

  // Totales generales — solo se muestran en la pestaña "Activos"
  const totalActiveLeads = activos.reduce((sum, u) => sum + computeStats(u.id, leads, dealsThisMonth).activeLeads, 0);
  const totalDealsThisMonth = dealsThisMonth.length;
  const totalRevenueThisMonth = dealsThisMonth.reduce((sum, d) => sum + Number(d.price || 0), 0);

  return (
    <div className="min-h-screen w-full pb-16" style={{ background: "#0B0E14", color: "#EDEFF2" }}>
      <div className="px-5 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1B2430" }}>
        <h1 style={{ fontFamily: F_DISPLAY, fontWeight: 700, fontSize: 22 }}>Admin — VAAS Closer Bot</h1>
        <button onClick={signOut} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5" }}>
          Salir
        </button>
      </div>

      <SystemControls onUpdate={setSystem} />
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

      {tab === "activos" && (
        <div className="px-5 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl p-3" style={{ background: "#141B24", border: "1px solid #232D3A" }}>
            <div style={{ fontSize: 10, color: "#8B96A5" }}>Leads activos (todos)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#22D3C0" }}>{totalActiveLeads}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#141B24", border: "1px solid #232D3A" }}>
            <div style={{ fontSize: 10, color: "#8B96A5" }}>Deals cerrados este mes</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#34D399" }}>{totalDealsThisMonth}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#141B24", border: "1px solid #232D3A" }}>
            <div style={{ fontSize: 10, color: "#8B96A5" }}>Ingresos este mes</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#F2B84B" }}>${totalRevenueThisMonth.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="px-5 mt-4 flex flex-col gap-3">
        {list.length === 0 && (
          <div className="text-sm text-center py-10" style={{ color: "#8B96A5" }}>
            Nada por aquí.
          </div>
        )}
        {list.map((u) => {
          const channel = channelFor(u.id);
          const dLeft = daysLeft(u.expires_at);
          const stats = tab === "activos" ? computeStats(u.id, leads, dealsThisMonth) : null;

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
                        style={{ background: channel?.connected ? "#34D399" : "#8B96A5" }}
                      />
                      <span style={{ fontSize: 11, color: "#8B96A5" }}>
                        {!system?'Revisando conexión…':channel?.connected?`WhatsApp conectado · ${channel.bot_enabled?'Bot activado':'Bot pausado'}`:'WhatsApp pendiente de conectar'} · {dLeft != null ? `${dLeft} días restantes` : ""}
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
                        Ver como miembro →
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

              {tab === "activos" && stats && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <div className="px-2 py-1 rounded-md text-[10px]" style={{ background: "#22D3C022", color: "#22D3C0" }}>
                    {stats.activeLeads} leads activos
                  </div>
                  <div className="px-2 py-1 rounded-md text-[10px]" style={{ background: "#8AB4F822", color: "#8AB4F8" }}>
                    {stats.negociando} negociando
                  </div>
                  <div className="px-2 py-1 rounded-md text-[10px]" style={{ background: "#34D39922", color: "#34D399" }}>
                    {stats.dealsCount} cerrados este mes (${stats.revenue.toLocaleString()})
                  </div>
                </div>
              )}

              {tab === "activos" && <a href={`/dashboard?as=${u.id}&tab=whatsapp`} className="block mt-3 text-sm text-teal-300">Conectar WhatsApp y controlar bot →</a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
