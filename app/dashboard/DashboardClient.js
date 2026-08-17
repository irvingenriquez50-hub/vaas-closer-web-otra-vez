"use client";
import { useState, useTransition, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveScript, savePricing, addLead, updateLeadStatus, toggleLeadPause, removeLead } from "./actions";
import { connectWhatsapp, whatsappStatus, resetWhatsapp } from "./whatsapp-actions";

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30];
const STAGES = [
  { key: "nuevo", label: "Nuevo" },
  { key: "escrito_enviado", label: "Escrito enviado" },
  { key: "esperando", label: "Esperando respuesta" },
  { key: "followup", label: "Follow-up" },
  { key: "negociando", label: "Negociando" },
  { key: "cerrado", label: "Cerrado" },
];
const stageIndex = (key) => Math.max(0, STAGES.findIndex((s) => s.key === key));

function defaultTiers() {
  return TIERS.map((n) => ({ videos: n, anchor: n === 1 ? 300 : 300 * n, floor: n === 1 ? 200 : 200 * n }));
}

function normalizePhoneForCountry(raw, country) {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  if (country === "other") return digits;
  if (country === "us") {
    if (digits.length === 10) return "1" + digits;
    return digits;
  }
  if (digits.length === 11 && !digits.startsWith("86")) return "86" + digits;
  return digits;
}

const emptyScriptFields = { gmvTotal: "", market: "Spanish-speaking", shortName: "", gmv30d: "", tiktokHandle: "" };

function buildPreviewText(fields, tiers) {
  const tier1 = tiers.find((t) => t.videos === 1);
  const tier5 = tiers.find((t) => t.videos === 5);
  const tier10 = tiers.find((t) => t.videos === 10);

  return `• FROM THE VAAS COMMUNITY •

I would love to work with your brand!

I've helped multiple brands generate millions of views and over $${fields.gmvTotal || "___"} GMV within the ${fields.market || "___"} U.S. audience.

To keep quality high and give each video the time needed to create the best possible content, I only work through retainers. All packages include ad usage rights unless otherwise discussed.

${fields.shortName || "___"} — RATES

1x Video — $${tier1?.anchor ?? "___"} per video

5x Videos/Month — $${tier5?.anchor ?? "___"}
(10% discount applied)

10x Videos/Month — $${tier10?.anchor ?? "___"}
(20% discount applied)

If this aligns with what you're looking for, I'd be happy to lock in a slot this week and start brainstorming content ideas tailored specifically to your brand.

Looking forward to working together,

Last 30 Days GMV: $${fields.gmv30d || "___"} USD

My TikTok Account: @${fields.tiktokHandle || "___"}

— The VAAS Community`;
}

export default function DashboardClient({ targetUserId, isAdminView, profile, initialTiers, initialScript, initialLeads }) {
  const [tab, setTab] = useState("escrito");
  const [scriptFields, setScriptFields] = useState({ ...emptyScriptFields, ...(initialScript || {}) });
  const [scriptSaved, setScriptSaved] = useState(true);

  const mergedTiers = defaultTiers().map((d) => {
    const found = (initialTiers || []).find((t) => t.videos === d.videos);
    return found ? { videos: d.videos, anchor: Number(found.anchor), floor: Number(found.floor) } : d;
  });
  const [tiers, setTiers] = useState(mergedTiers);
  const [tiersSaved, setTiersSaved] = useState(true);

  const [leads, setLeads] = useState(initialLeads || []);
  const [phoneInput, setPhoneInput] = useState("");
  const [addCountry, setAddCountry] = useState("china");
  const [leadError, setLeadError] = useState("");
  const [pending, startTransition] = useTransition();

  const [waConnected, setWaConnected] = useState(false);
  const [waLoading, setWaLoading] = useState(false);

  const checkWaStatus = useCallback(async () => {
    const res = await whatsappStatus(targetUserId);
    setWaConnected(!!res.connected);
  }, [targetUserId]);

  useEffect(() => {
    checkWaStatus();
    const interval = setInterval(checkWaStatus, 4000);
    return () => clearInterval(interval);
  }, [checkWaStatus]);

  const doConnectWhatsapp = async () => {
    setWaLoading(true);
    await connectWhatsapp(targetUserId);
    await checkWaStatus();
    setWaLoading(false);
  };

  const doResetWhatsapp = async () => {
    if (!confirm("Esto refresca la conexión con tu número de WhatsApp Business. ¿Seguro?")) return;
    setWaLoading(true);
    await resetWhatsapp(targetUserId);
    await checkWaStatus();
    setWaLoading(false);
  };

  const doSaveScript = () => {
    startTransition(async () => {
      await saveScript(targetUserId, scriptFields);
      setScriptSaved(true);
    });
  };

  const doSavePricing = () => {
    startTransition(async () => {
      await savePricing(targetUserId, tiers);
      setTiersSaved(true);
    });
  };

  const [manualFirstMessage, setManualFirstMessage] = useState(false);

  const doAddLead = () => {
    if (!phoneInput.trim()) return;
    const normalized = normalizePhoneForCountry(phoneInput, addCountry);
    startTransition(async () => {
      const res = await addLead(targetUserId, normalized, manualFirstMessage);
      if (res?.error) {
        setLeadError(res.error);
      } else {
        setLeadError("");
        setPhoneInput("");
        setLeads((l) => [{ id: crypto.randomUUID(), phone: normalized, status: manualFirstMessage ? "esperando" : "nuevo", timezone: addCountry, paused: false, updated_at: new Date().toISOString() }, ...l]);
      }
    });
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const F_DISPLAY = "'Space Grotesk', sans-serif";
  const F_MONO = "'IBM Plex Mono', monospace";

  return (
    <div className="min-h-screen w-full pb-16" style={{ background: "#0B0E14", color: "#EDEFF2" }}>
      {isAdminView && (
        <div className="px-5 py-2 text-center text-xs" style={{ background: "#F2B84B22", color: "#F2B84B" }}>
          Viendo como {profile?.name || profile?.email} (modo admin)
        </div>
      )}

      <div className="px-5 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1B2430" }}>
        <div>
          <h1 style={{ fontFamily: F_DISPLAY, fontWeight: 700, fontSize: 22 }}>VAAS Closer Bot</h1>
          <div style={{ fontSize: 12, color: "#8B96A5" }}>{profile?.name || profile?.email}</div>
        </div>
        {!isAdminView && (
          <button onClick={signOut} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5" }}>
            Salir
          </button>
        )}
      </div>

      <div className="px-5 pt-4 flex gap-2">
        {[
          ["whatsapp", "WhatsApp"],
          ["escrito", "Tu escrito"],
          ["precios", "Precios"],
          ["cola", "Cola de contactos"],
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

      {tab === "whatsapp" && (
        <div className="px-5 pt-4 flex flex-col items-center text-center">
          {waConnected ? (
            <div className="w-full rounded-xl p-6" style={{ background: "#141B24", border: "1px solid #34D399" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#34D399" }}>WhatsApp conectado ✓</div>
              <div style={{ fontSize: 12, color: "#8B96A5", marginTop: 6 }}>
                Tu bot ya puede mandar y recibir mensajes en tu número. Sigues usando WhatsApp normal en tu teléfono sin problema.
              </div>
            </div>
          ) : (
            <div className="w-full rounded-xl p-6" style={{ background: "#141B24", border: "1px solid #232D3A" }}>
              <div style={{ fontSize: 13, color: "#8B96A5", marginBottom: 14 }}>
                Tu número de WhatsApp Business todavía no está activo en el sistema.
              </div>
              <button
                onClick={doConnectWhatsapp}
                disabled={waLoading}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "#22D3C0", color: "#06110F" }}
              >
                {waLoading ? "Activando..." : "Activar WhatsApp"}
              </button>
            </div>
          )}

          {!waLoading && (
            <button
              onClick={doResetWhatsapp}
              className="mt-4 text-xs"
              style={{ color: "#8B96A5", textDecoration: "underline" }}
            >
              ¿Problemas? Refrescar conexión
            </button>
          )}
        </div>
      )}

      {tab === "escrito" && (
        <div className="px-5 pt-4">
          <div style={{ fontSize: 12, color: "#8B96A5", marginBottom: 12 }}>
            Estos datos rellenan el mensaje 1 (el que el bot manda a cada número nuevo) — el texto en sí ya está aprobado por WhatsApp, tú solo llenas tus datos.
          </div>

          <div className="flex flex-col gap-3">
            <Field label="GMV total (ej. 2M)">
              <input value={scriptFields.gmvTotal} onChange={(e) => { setScriptFields({ ...scriptFields, gmvTotal: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="2M" />
            </Field>
            <Field label="Mercado / audiencia">
              <input value={scriptFields.market} onChange={(e) => { setScriptFields({ ...scriptFields, market: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="Spanish-speaking" />
            </Field>
            <Field label="Tu nombre (para el mensaje)">
              <input value={scriptFields.shortName} onChange={(e) => { setScriptFields({ ...scriptFields, shortName: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="Irving" />
            </Field>
            <Field label="GMV últimos 30 días">
              <input value={scriptFields.gmv30d} onChange={(e) => { setScriptFields({ ...scriptFields, gmv30d: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="100k" />
            </Field>
            <Field label="Tu usuario de TikTok (sin @)">
              <input value={scriptFields.tiktokHandle} onChange={(e) => { setScriptFields({ ...scriptFields, tiktokHandle: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="tuusuario" />
            </Field>
          </div>

          <button
            onClick={doSaveScript}
            disabled={pending}
            className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: scriptSaved ? "#141B24" : "#22D3C0", color: scriptSaved ? "#8B96A5" : "#06110F", border: scriptSaved ? "1px solid #232D3A" : "none" }}
          >
            {scriptSaved ? "Guardado ✓" : "Guardar escrito"}
          </button>

          <div style={{ fontSize: 11, color: "#8B96A5", marginTop: 20, marginBottom: 8 }}>Vista previa (usa tus precios ya guardados):</div>
          <div
            className="w-full rounded-xl p-3 text-xs whitespace-pre-wrap"
            style={{ background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5", fontFamily: F_MONO, lineHeight: 1.6 }}
          >
            {buildPreviewText(scriptFields, tiers)}
          </div>
        </div>
      )}

      {tab === "precios" && (
        <div className="px-5 pt-4">
          <div style={{ fontSize: 12, color: "#8B96A5", marginBottom: 10 }}>Tu ancla y tu piso, paquete por paquete:</div>
          <div className="flex flex-col gap-2 mb-3">
            {tiers.map((t, i) => (
              <div key={t.videos} className="flex items-center gap-2.5">
                <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ width: 62, background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5" }}>
                  {t.videos} vid{t.videos === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 11, color: "#8B96A5" }}>ancla $</span>
                  <input
                    type="number"
                    value={t.anchor}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTiers((prev) => prev.map((p, idx) => (idx === i ? { ...p, anchor: v } : p)));
                      setTiersSaved(false);
                    }}
                    style={{ width: 72, background: "#141B24", border: "1px solid #232D3A", borderRadius: 8, padding: "5px 8px", fontFamily: F_MONO, fontSize: 13, color: "#F2B84B" }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 11, color: "#8B96A5" }}>piso $</span>
                  <input
                    type="number"
                    value={t.floor}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTiers((prev) => prev.map((p, idx) => (idx === i ? { ...p, floor: v } : p)));
                      setTiersSaved(false);
                    }}
                    style={{ width: 72, background: "#141B24", border: "1px solid #232D3A", borderRadius: 8, padding: "5px 8px", fontFamily: F_MONO, fontSize: 13, color: "#34D399" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={doSavePricing}
            disabled={pending}
            className="w-full py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: tiersSaved ? "#141B24" : "#22D3C0", color: tiersSaved ? "#8B96A5" : "#06110F", border: tiersSaved ? "1px solid #232D3A" : "none" }}
          >
            {tiersSaved ? "Guardado ✓" : "Guardar precios"}
          </button>
        </div>
      )}

      {tab === "cola" && (
        <div className="px-5 pt-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center rounded-xl px-3 py-2.5" style={{ background: "#141B24", border: "1px solid #232D3A" }}>
              <input
                value={phoneInput}
                onChange={(e) => { setPhoneInput(e.target.value); if (leadError) setLeadError(""); }}
                onKeyDown={(e) => e.key === "Enter" && doAddLead()}
                placeholder="8613576038204 o +1 555 123 4567 — cualquier formato sirve"
                className="bg-transparent outline-none flex-1 text-sm"
                style={{ color: "#EDEFF2", fontFamily: F_MONO }}
              />
            </div>
            <button
              onClick={() => setAddCountry((c) => (c === "china" ? "us" : c === "us" ? "other" : "china"))}
              className="px-3 rounded-xl text-xs font-semibold"
              style={
                addCountry === "us"
                  ? { background: "#22D3C022", color: "#22D3C0", border: "1px solid #22D3C0" }
                  : addCountry === "other"
                  ? { background: "#8B96A522", color: "#8B96A5", border: "1px solid #8B96A5" }
                  : { background: "#F2B84B22", color: "#F2B84B", border: "1px solid #F2B84B" }
              }
              title="Toca para cambiar el país — se agrega el código automático"
            >
              {addCountry === "us" ? "🇺🇸 US" : addCountry === "other" ? "🌐 Otro" : "🇨🇳 CN"}
            </button>
            <button onClick={doAddLead} className="px-4 rounded-xl text-sm font-semibold" style={{ background: "#22D3C0", color: "#06110F" }}>
              Agregar
            </button>
          </div>
          <label className="flex items-center gap-2 mt-2 px-1" style={{ fontSize: 11.5, color: "#8B96A5" }}>
            <input
              type="checkbox"
              checked={manualFirstMessage}
              onChange={(e) => setManualFirstMessage(e.target.checked)}
            />
            Ya le mandé el escrito yo mismo desde mi teléfono — el bot solo negocia cuando conteste
          </label>
          {leadError && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#2A1620", color: "#F19999", border: "1px solid #4A2530" }}>
              {leadError}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {leads.length === 0 && (
              <div className="text-sm text-center py-10" style={{ color: "#8B96A5" }}>
                Sin números en cola todavía.
              </div>
            )}
            {leads.map((lead) => {
              const idx = stageIndex(lead.status);
              return (
                <div key={lead.id} className="rounded-xl p-4" style={{ background: "#141B24", border: lead.paused ? "1px solid #F2B84B" : "1px solid #232D3A" }}>
                  <div className="flex items-center justify-between">
                    <div style={{ fontFamily: F_MONO, fontSize: 14, fontWeight: 600 }}>{lead.phone}</div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          const next = !lead.paused;
                          setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, paused: next } : l)));
                          startTransition(() => toggleLeadPause(targetUserId, lead.id, next));
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: lead.paused ? "#F2B84B22" : "#1B2430", color: lead.paused ? "#F2B84B" : "#8B96A5" }}
                      >
                        {lead.paused ? "Pausado" : "Pausar"}
                      </button>
                      <button
                        onClick={() => {
                          setLeads((prev) => prev.filter((l) => l.id !== lead.id));
                          startTransition(() => removeLead(targetUserId, lead.id));
                        }}
                        className="px-2 py-1 rounded-lg text-[10px]"
                        style={{ background: "#1B2430", color: "#8B96A5" }}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center">
                    {STAGES.map((s, i) => (
                      <div key={s.key} className="flex items-center flex-1">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: i <= idx ? (s.key === "cerrado" ? "#34D399" : "#22D3C0") : "#232D3A" }} title={s.label} />
                        {i < STAGES.length - 1 && <div className="flex-1 h-[2px]" style={{ background: i < idx ? "#22D3C0" : "#232D3A" }} />}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span style={{ fontSize: 11, color: "#8B96A5" }}>{STAGES[idx].label}</span>
                    {idx < STAGES.length - 1 && (
                      <button
                        onClick={() => {
                          const nextKey = STAGES[idx + 1].key;
                          setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: nextKey } : l)));
                          startTransition(() => updateLeadStatus(targetUserId, lead.id, nextKey));
                        }}
                        className="text-[11px] font-medium"
                        style={{ color: "#22D3C0" }}
                      >
                        Marcar {STAGES[idx + 1].label} →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { background: "#000", border: "1px solid #242119", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "#F5F3EC", width: "100%", outline: "none" };

function Field({ label, children }) {
  return (
    <div className="flex-1">
      <div className="text-[11.5px] mb-1.5" style={{ color: "#8C8574" }}>{label}</div>
      {children}
    </div>
  );
}
