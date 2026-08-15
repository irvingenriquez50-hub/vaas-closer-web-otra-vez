"use client";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveUser, renewUser, deactivateUser, saveWhatsappChannel } from "./actions";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export default function AdminClient({ users, sessions, channels }) {
  const [tab, setTab] = useState("pendientes");
  const [pending, startTransition] = useTransition();
  const [apiKeyDrafts, setApiKeyDrafts] = useState({});
  const [phoneDrafts, setPhoneDrafts] = useState({});
  const [savedFlash, setSavedFlash] = useState({});

  const sessionFor = (userId) => sessions.find((s) => s.user_id === userId);
  const channelFor = (userId) => channels.find((c) => c.user_id === userId);

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

  const doSaveChannel = (userId) => {
    const apiKey = apiKeyDrafts[userId] || "";
    const phone = phoneDrafts[userId] || "";
    if (!apiKey.trim() || !phone.trim()) return;
    startTransition(async () => {
      await saveWhatsappChannel(userId, apiKey, phone);
      setSavedFlash((f) => ({ ...f, [userId]: true }));
      setApiKeyDrafts((d) => ({ ...d, [userId]: "" }));
      setTimeout(() => setSavedFlash((f) => ({ ...f, [userId]: false })), 3000);
    });
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
          const channel = channelFor(u.id);
          const dLeft = daysLeft(u.expires_at);
          const hasChannel = !!channel?.d360_api_key;

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

              {tab === "activos" && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid #232D3A" }}>
                  <div style={{ fontSize: 11, color: "#8B96A5", marginBottom: 6 }}>
                    WhatsApp Business — 360dialog
                    {hasChannel && (
                      <span style={{ color: "#34D399", marginLeft: 6 }}>
                        ✓ {channel.phone_number}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Número (ej. 13463207120)"
                      value={phoneDrafts[u.id] ?? channel?.phone_number ?? ""}
                      onChange={(e) => setPhoneDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                      className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={{ width: 160, background: "#0B0E14", border: "1px solid #232D3A", color: "#EDEFF2", fontFamily: F_MONO }}
                    />
                    <input
                      type="password"
                      placeholder="API Key de 360dialog"
                      value={apiKeyDrafts[u.id] ?? ""}
                      onChange={(e) => setApiKeyDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                      className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={{ background: "#0B0E14", border: "1px solid #232D3A", color: "#EDEFF2", fontFamily: F_MONO }}
                    />
                    <button
                      onClick={() => doSaveChannel(u.id)}
                      disabled={pending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                      style={{ background: savedFlash[u.id] ? "#34D399" : "#22D3C0", color: "#06110F" }}
                    >
                      {savedFlash[u.id] ? "Guardado ✓" : "Guardar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
