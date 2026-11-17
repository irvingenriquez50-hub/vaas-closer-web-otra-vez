"use client";
import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveScript, savePricing, addLead, updateLeadStatus, toggleLeadPause, removeLead, restartLead, resolveLeadManually, markAsCollab } from "./actions";

import AutopilotPanel from './AutopilotPanel';
import ConnectionCard from "./ConnectionCard";
import ScriptApproval from './TemplateApproval';
import {openingPreview} from '@/lib/template-approval.mjs';
import {OPENING_NAME,FOLLOWUP_NAME,FOLLOWUP_BODY} from '@/lib/whatsapp-templates.mjs';
import { useRouter } from "next/navigation";
import { getDiscordCalendar, importDay, listLeadRequests, activateLeadRequest, rejectLeadRequest, markOngoingRequest, resetDayRequests, getDayStatuses } from "./discord-actions";

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTOS EN ESPAÑOL E INGLÉS
   Se guarda el idioma en la MISMA llave que el Retainer Tracker ("vaas-lang"),
   así los dos quedan sincronizados: lo cambias en uno y el otro también.
   OJO: la VISTA PREVIA DEL ESCRITO (buildPreviewText) NO se traduce nunca — ese
   es el mensaje que le llega a la marca y siempre va en inglés.
   ═══════════════════════════════════════════════════════════════════════════ */
const STRINGS = {
  // Encabezado
  viewing_as: { es: "Viendo como {name} (modo admin)", en: "Viewing as {name} (admin mode)" },
  back_to_admin: { es: "← Volver al admin", en: "← Back to admin" },
  sign_out: { es: "Salir", en: "Log out" },

  // Pestañas
  tab_whatsapp: { es: "WhatsApp", en: "WhatsApp" },
  tab_escrito: { es: "Tu escrito", en: "Your script" },
  tab_precios: { es: "Precios", en: "Pricing" },
  tab_cola: { es: "Cola de contactos", en: "Contact queue" },
  tab_revision: { es: "Contactos", en: "Contacts" },

  // WhatsApp
  wa_connected: { es: "WhatsApp conectado ✓", en: "WhatsApp connected ✓" },
  wa_connected_sub: {
    es: "Tu bot ya puede mandar y recibir mensajes en tu número. Sigues usando WhatsApp normal en tu teléfono sin problema.",
    en: "Your bot can now send and receive messages on your number. You can keep using WhatsApp normally on your phone.",
  },
  wa_not_active: { es: "Tu número de WhatsApp Business todavía no está activo en el sistema.", en: "Your WhatsApp Business number isn't active in the system yet." },
  wa_activating: { es: "Activando...", en: "Activating..." },
  wa_activate: { es: "Activar WhatsApp", en: "Activate WhatsApp" },
  wa_refresh: { es: "¿Problemas? Refrescar conexión", en: "Having trouble? Refresh connection" },
  wa_refresh_confirm: { es: "Esto refresca la conexión con tu número de WhatsApp Business. ¿Seguro?", en: "This refreshes the connection to your WhatsApp Business number. Are you sure?" },
  wa_engine_error: { es: "No se pudo consultar el motor de WhatsApp.", en: "Couldn't reach the WhatsApp engine." },

  // Tu escrito
  script_intro: {
    es: "Estos datos rellenan tu primer mensaje. Con WhatsApp conectado y los precios guardados, al guardar se solicita la aprobación automáticamente. Si la plantilla ya está aprobada, actualizar estos datos no requiere otra aprobación.",
    en: "These fields fill in your first message. With WhatsApp connected and prices saved, saving automatically requests approval. Updating these details does not require another approval if the template is already approved.",
  },
  f_gmv_total: { es: "GMV total (ej. 2M)", en: "Total GMV (e.g. 2M)" },
  f_market: { es: "Mercado / audiencia", en: "Market / audience" },
  f_shortname: { es: "Tu nombre (para el mensaje)", en: "Your name (for the message)" },
  f_gmv30: { es: "GMV últimos 30 días", en: "Last 30 days GMV" },
  f_tiktok: { es: "Tu usuario de TikTok (sin @)", en: "Your TikTok handle (no @)" },
  ph_tiktok: { es: "tuusuario", en: "yourhandle" },
  saved_check: { es: "Guardado ✓", en: "Saved ✓" },
  save_script: { es: "Guardar escrito", en: "Save script" },
  preview_label: { es: "Vista previa del primer mensaje (guarda tus cambios antes de usarlo):", en: "First message preview (save your changes before using it):" },

  // Precios
  price_intro: {
    es: 'Precio por video — al actualizar, se rellena toda la tabla de abajo automáticamente (todavía no se guarda, tienes que darle "Guardar precios" después).',
    en: 'Price per video — updating fills in the whole table below automatically (it isn\'t saved yet, you still have to hit "Save pricing").',
  },
  ph_price: { es: "ej. 450", en: "e.g. 450" },
  per_video: { es: "por video", en: "per video" },
  updated_check: { es: "Actualizado ✓", en: "Updated ✓" },
  update_table: { es: "Actualizar tabla", en: "Update table" },
  tiers_intro: { es: "Tu ancla, medio y piso, paquete por paquete:", en: "Your anchor, mid and floor, package by package:" },
  vid_short: { es: "vid", en: "vid" },
  vids_short: { es: "vids", en: "vids" },
  high_label: { es: "alto $", en: "high $" },
  mid_label: { es: "medio $", en: "mid $" },
  floor_label: { es: "piso $", en: "floor $" },
  save_pricing: { es: "Guardar precios", en: "Save pricing" },

  // Cola — agregar
  ph_phone: { es: "8613576038204 o +1 555 123 4567 — cualquier formato sirve", en: "8613576038204 or +1 555 123 4567 — any format works" },
  wa_open_title: { es: "Abrir este número en WhatsApp para mandarle el escrito a mano — luego regresas y le picas Agregar", en: "Open this number in WhatsApp to send the script by hand — then come back and hit Add" },
  country_other: { es: "Otro", en: "Other" },
  country_title: { es: "Toca para cambiar el país — se agrega el código automático", en: "Tap to change the country — the code is added automatically" },
  add_btn: { es: "Agregar", en: "Add" },
  autosend_label: { es: "No le he mandado el escrito — que lo mande el bot automáticamente", en: "I haven't sent the script — let the bot send it automatically" },
  already_collab_btn: { es: "🤝 Ya tengo colab", en: "🤝 Already collab" },
  already_collab_title: { es: "Guarda este número como colaboración que ya tienes — el bot no le escribe nunca", en: "Save this number as a collab you already have — the bot never messages them" },
  collab_confirm: { es: "¿Ya tienes colaboración con {phone}?\n\nSe guarda y el bot NUNCA le va a escribir. No se manda ningún mensaje.", en: "Do you already have a collab with {phone}?\n\nIt gets saved and the bot will NEVER message them. No message is sent." },
  collab_save_error: { es: "No se pudo guardar:\n\n{err}", en: "Couldn't save:\n\n{err}" },

  // Cola — lista
  empty_queue: { es: "Sin números en cola todavía.", en: "No numbers in the queue yet." },
  empty_filter: { es: "No hay contactos en este filtro.", en: "No contacts in this filter." },
  last_activity: { es: "Último movimiento: {when}", en: "Last activity: {when}" },
  open_wa_title: { es: "Abrir conversación en WhatsApp", en: "Open conversation in WhatsApp" },
  view_chat: { es: "Ver chat", en: "View chat" },
  hide_chat: { es: "Ocultar chat", en: "Hide chat" },
  view_chat_title: { es: "Ver el chat aquí, sin abrir WhatsApp — así el bot no se pausa", en: "View the chat here without opening WhatsApp — that way the bot doesn't pause" },
  restart: { es: "Reiniciar", en: "Restart" },
  restart_failed_title: { es: "Borra este intento fallido y precarga el número arriba para agregarlo de nuevo", en: "Deletes this failed attempt and preloads the number above so you can add it again" },
  restart_cross_title: { es: "Nunca se cerró nada — reinicia y manda el escrito otra vez", en: "Nothing was ever closed — restart and send the script again" },
  restart_sleep_title: { es: "Volver a mandarle el escrito desde cero", en: "Send them the script again from scratch" },
  mark_resolved: { es: "Marcar resuelto", en: "Mark resolved" },
  mark_resolved_title: { es: "Ya hubo un deal — archiva sin reportar al tracker", en: "There was already a deal — archive without reporting to the tracker" },
  paused: { es: "Pausado", en: "Paused" },
  pause: { es: "Pausar", en: "Pause" },
  collab_short: { es: "🤝 Colab", en: "🤝 Collab" },
  collab_short_title: { es: "Ya tengo colaboración — cierra el contacto de un jalón", en: "Already have a collab — closes the contact in one tap" },
  collab_card_confirm: { es: "¿Ya tienes colaboración con {phone}?\n\nEl contacto se cierra y el bot NUNCA le vuelve a escribir. No se reporta nada a tu Retainer Tracker.", en: "Do you already have a collab with {phone}?\n\nThe contact gets closed and the bot will NEVER message them again. Nothing is reported to your Retainer Tracker." },
  delete_btn: { es: "Borrar", en: "Delete" },
  resolve_confirm: { es: "Esto archiva el contacto sin reportarlo a tu Retainer Tracker. ¿Seguro?", en: "This archives the contact without reporting it to your Retainer Tracker. Are you sure?" },

  // Avisos de las tarjetas
  collab_banner: {
    es: "🤝 Marcaste que ya tienes colaboración con este número — el bot no le escribe. Si te llega otro producto de este mismo contacto, escríbele tú a mano.",
    en: "🤝 You marked that you already have a collab with this number — the bot won't message them. If another product comes from this same contact, message them yourself.",
  },
  muted_title: { es: "🔇 La marca escribió hace {hours}h y el bot todavía no le contesta.", en: "🔇 The brand wrote {hours}h ago and the bot still hasn't replied." },
  muted_closed: { es: "La ventana de 24h de WhatsApp ya cerró — el bot ya no puede escribirle. Contéstalo tú a mano.", en: "The 24h WhatsApp window has closed — the bot can't message them anymore. Reply by hand." },
  muted_open: { es: "El sistema lo va a reintentar solo. Si no se destraba, contéstalo a mano antes de que se cumplan 24h.", en: "The system will retry on its own. If it stays stuck, reply by hand before the 24h are up." },
  reply_on_wa: { es: "Contestar en WhatsApp ↗", en: "Reply on WhatsApp ↗" },
  ill_handle_it: { es: "Yo me encargo", en: "I'll handle it" },
  ill_handle_title: { es: "Pausa el bot en este contacto y quita este aviso", en: "Pauses the bot on this contact and removes this warning" },
  ill_handle_confirm: { es: '¿Tú te encargas de {phone}?\n\nEl bot se PAUSA para este contacto y deja de contestarle. Cuando quieras que vuelva a trabajarlo, pícale a "Pausado" para reactivarlo.', en: 'Are you handling {phone}?\n\nThe bot PAUSES on this contact and stops replying. When you want it back on the job, tap "Paused" to reactivate it.' },
  delivery_failed: { es: "La entrega del mensaje falló.", en: "Message delivery failed." },
  cross_banner: { es: "Revisa tu conversación de WhatsApp antes de volver a escribir.", en: "Review your WhatsApp conversation before sending again." },
  checkback_banner: { es: "🔁 Seguimiento semanal {n}/4 — dijeron que ahorita no hay nada pero que te avisan. El bot les pregunta cada 7 días.", en: "🔁 Weekly check-in {n}/4 — they said there's nothing right now but they'll let you know. The bot asks every 7 days." },
  dormant_revive: { es: "😴 Nunca contestó — el bot le manda el escrito otra vez {when}. Es su única segunda vuelta.", en: "😴 Never replied — the bot sends the script again {when}. This is their only second round." },
  dormant_next_send: { es: "en el próximo envío", en: "on the next send" },
  dormant_in_days: { es: "en {n} día{s}", en: "in {n} day{s}" },
  dormant_answered: { es: "😴 Aquí sí hubo respuesta en su momento — el bot ya no le vuelve a escribir solo.", en: "😴 There was a reply at some point — the bot won't message them again on its own." },
  dormant_done: { es: "😴 Ya tuvo su segunda vuelta a los 30 días — el bot ya no le escribe más.", en: "😴 They already had their 30-day second round — the bot won't message them anymore." },
  waiting_brand: { es: " · ⏳ confirmando con la marca", en: " · ⏳ confirming with the brand" },
  waiting_day: { es: " (día {n}/3)", en: " (day {n}/3)" },
  mark_next: { es: "Marcar {stage} →", en: "Mark {stage} →" },

  // Activar contacto
  activate_history: {
    es: '⚠️ YA HAY HISTORIAL con {phone}:\n\n{summary}\n\n¿Quieres REINICIAR y darle otra vuelta a este contacto?\n(El chat guardado no se borra.)\n\nSi ya tienes colaboración con esta persona, dale Cancelar y pícale "Ya tengo colab".',
    en: '⚠️ THERE IS ALREADY HISTORY with {phone}:\n\n{summary}\n\nDo you want to RESTART and give this contact another round?\n(The saved chat is not deleted.)\n\nIf you already have a collab with this person, hit Cancel and tap "Already collab".',
  },
  activate_error: { es: "No se pudo activar {phone}:\n\n{err}", en: "Couldn't activate {phone}:\n\n{err}" },

  // Revisión
  calendar_intro: {
    es: "Calendario — toca un mes y luego un día para traer sus contactos. Recarga la página si mandaron contactos nuevos y no los ves.",
    en: "Calendar — tap a month, then a day, to pull in its contacts. Reload the page if new contacts were posted and you don't see them.",
  },
  calendar_loading: { es: "Cargando calendario...", en: "Loading calendar..." },
  calendar_empty: { es: "No hay contactos en este periodo.", en: "No contacts in this period." },
  month_pending_title: { es: "{n} pendientes de revisar", en: "{n} pending review" },
  day_done_title: { es: "Ya trabajaste todos los contactos de este día", en: "You've worked all the contacts from this day" },
  day_pending_title: { es: "Faltan {n} contacto(s) por revisar de este día", en: "{n} contact(s) from this day still need review" },
  day_not_imported_title: { es: "Este día todavía no se ha importado", en: "This day hasn't been imported yet" },
  loading: { es: "Cargando...", en: "Loading..." },
  reset_day_title: { es: "Resetear los contactos de este día que nunca contestaron", en: "Reset this day's contacts that never replied" },
  reset_day_confirm: {
    es: "¿Seguro que quieres resetear el día {day}?\n\nLos contactos que nunca contestaron nada volverán a aparecer para mandarles el mensaje otra vez. Las conversaciones reales o tratos ya cerrados NO se tocan.",
    en: "Are you sure you want to reset {day}?\n\nContacts that never replied will show up again so you can message them once more. Real conversations and closed deals are NOT touched.",
  },
  reset_result: { es: "Listo — {n} contacto{s} reseteado{s}", en: "Done — {n} contact{s} reset" },
  reset_protected: { es: ", {n} protegido{s} (ya tenían conversación real).", en: ", {n} protected (they already had a real conversation)." },
  nothing_to_review: { es: "Nada por revisar todavía — toca un día del calendario de arriba.", en: "Nothing to review yet — tap a day on the calendar above." },

  // Tarjeta de Revisión
  rc_product: { es: "Producto", en: "Product" },
  rc_cross: { es: "⚠️ Ya tienes historial con este número en otro miembro.", en: "⚠️ You already have history with this number under another member." },
  rc_autosend: { es: "No le he mandado el mensaje — que lo mande el bot automáticamente", en: "I haven't sent the message — let the bot send it automatically" },
  rc_start: { es: "Empezar", en: "Start" },
  rc_collab: { es: "Ya tengo colab", en: "Already collab" },
  rc_collab_title: { es: "Ya tengo colaboración con esta persona — no lo vuelvas a mostrar", en: "I already have a collab with this person — don't show them again" },
  rc_collab_confirm: { es: "¿Seguro que ya tienes colaboración con {phone}?\n\nSi le picas que sí, este contacto no vuelve a aparecer nunca, aunque reimportes ese día.", en: "Are you sure you already have a collab with {phone}?\n\nIf you say yes, this contact never shows up again, even if you re-import that day." },
  rc_reject: { es: "Rechazar", en: "Reject" },
  rc_reject_confirm: { es: "¿Seguro que quieres rechazar {phone}?\n\nSe quita de la lista. Si algún día reseteas ese día, puede volver a aparecer.", en: "Are you sure you want to reject {phone}?\n\nIt gets removed from the list. If you ever reset that day, it may show up again." },

  // Etapas
  st_nuevo: { es: "Nuevo", en: "New" },
  st_escrito_enviado: { es: "Escrito enviado", en: "Script sent" },
  st_esperando: { es: "Esperando respuesta", en: "Awaiting reply" },
  st_followup: { es: "Follow-up", en: "Follow-up" },
  st_negociando: { es: "Negociando", en: "Negotiating" },
  st_cerrado: { es: "Cerrado", en: "Closed" },

  // Filtros
  fl_todos: { es: "Todos", en: "All" },
  fl_mudos: { es: "🔇 Sin contestar", en: "🔇 Unanswered" },
  fl_nuevo: { es: "Nuevos", en: "New" },
  fl_escrito_enviado: { es: "Enviados", en: "Sent" },
  fl_esperando: { es: "Esperando", en: "Waiting" },
  fl_followup: { es: "Follow-up", en: "Follow-up" },
  fl_negociando: { es: "Negociando", en: "Negotiating" },
  fl_cerrado: { es: "Cerrados", en: "Closed" },
  fl_checkback: { es: "🔁 Seguimiento", en: "🔁 Check-in" },
  fl_dormant: { es: "Dormidos", en: "Asleep" },
  fl_cruzado: { es: "Por revisar", en: "Needs review" },
  fl_fallido: { es: "Fallidos", en: "Failed" },
  fl_colab: { es: "🤝 Ya tengo colab", en: "🤝 Already collab" },
};

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30];
const STAGES = [
  { key: "nuevo", label: "st_nuevo" },
  { key: "escrito_enviado", label: "st_escrito_enviado" },
  { key: "esperando", label: "st_esperando" },
  { key: "followup", label: "st_followup" },
  { key: "negociando", label: "st_negociando" },
  { key: "cerrado", label: "st_cerrado" },
];
const stageIndex = (key) => Math.max(0, STAGES.findIndex((s) => s.key === key));

// Burbujas de filtro de la cola, en el orden del embudo real: de lo que no se ha
// mandado hasta lo cerrado, y al final los que necesitan que Irving haga algo.
// Solo se pintan las que tienen al menos 1 contacto, para que no se llene de
// burbujas vacías.
const MUTED_KEY = "mudos";
const COLLAB_KEY = "colab";

const LEAD_FILTERS = [
  { key: "todos", label: "fl_todos", color: "#22D3C0" },
  { key: MUTED_KEY, label: "fl_mudos", color: "#FF5C5C" },
  { key: "nuevo", label: "fl_nuevo", color: "#8AB4F8" },
  { key: "escrito_enviado", label: "fl_escrito_enviado", color: "#22D3C0" },
  { key: "esperando", label: "fl_esperando", color: "#8B96A5" },
  { key: "followup", label: "fl_followup", color: "#F2B84B" },
  { key: "negociando", label: "fl_negociando", color: "#C084FC" },
  { key: "cerrado", label: "fl_cerrado", color: "#34D399" },
  { key: "checkback", label: "fl_checkback", color: "#8AB4F8" },
  { key: "dormant", label: "fl_dormant", color: "#6B7684" },
  { key: "cruzado", label: "fl_cruzado", color: "#F2B84B" },
  { key: "fallido", label: "fl_fallido", color: "#F19999" },
  { key: COLLAB_KEY, label: "fl_colab", color: "#34D399" },
];

const localeOf = (lang) => (lang === "en" ? "en-US" : "es-MX");

/** Contactos que marcaste a mano como "ya tengo colaboración con esta persona".
 * Quedan cerrados y pausados: el bot no les escribe nunca. No es un trato del
 * bot, por eso lleva su propia marca y su propio filtro. */
const isCollabLead = (lead) => !!lead?.negotiation?.manualCollab;

/** Detecta contactos MUDOS: la marca escribió y el bot todavía no ha contestado.
 * Esto pasaba antes en silencio — el mensaje llegaba, el temporizador de respuesta
 * se perdía por un reinicio del servidor, y el contacto se quedaba muerto sin que
 * nadie se enterara. Ahora se ve aquí en rojo.
 * Devuelve null si todo está normal. Se ignoran los pausados (esos ya los tomaste
 * tú) y los cerrados, dormidos o fallidos. */
function mutedInfo(lead) {
  if (!lead || lead.paused) return null;
  if (["cerrado", "dormant", "fallido"].includes(lead.status)) return null;
  if (!lead.last_inbound_at) return null;

  const inbound = new Date(lead.last_inbound_at).getTime();
  const outbound = lead.last_outbound_at ? new Date(lead.last_outbound_at).getTime() : 0;
  if (isNaN(inbound) || inbound <= outbound) return null; // ya se le contestó

  const hours = (Date.now() - inbound) / 3600000;
  // Menos de 1 hora es operación normal: el bot espera unos minutos a propósito
  // para juntar mensajes seguidos, y el rescate automático entra a los 15 min.
  if (hours < 1) return null;

  return { hours: Math.round(hours), windowClosed: hours >= 24 };
}

/** Fecha corta (08/21) del último movimiento del contacto, con la fecha completa
 * en el tooltip. Se prefiere la fecha en que SALIÓ el último mensaje; si el lead
 * es tan viejo que no la tiene guardada, se cae a cuándo se creó. */
function leadDate(lead, lang) {
  const raw = lead.last_outbound_at || lead.created_at || lead.updated_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return {
    short: d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }),
    full: d.toLocaleString(localeOf(lang), { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }),
  };
}

const PRICE_TABLES = {
  500: { 1:[500,450,400],2:[1000,900,800],3:[1500,1350,1200],4:[2050,1800,1600],5:[2250,2100,1900],6:[2700,2550,2400],7:[3150,2950,2800],8:[3600,3400,3200],9:[4050,3850,3600],10:[4000,3750,3500],15:[5250,4850,4500],20:[7000,6500,6000],30:[9000,8250,7500] },
  450: { 1:[450,400,350],2:[900,800,700],3:[1350,1200,1050],4:[1800,1600,1400],5:[2050,1800,1600],6:[2450,2200,1900],7:[2850,2550,2250],8:[3300,2950,2550],9:[3700,3300,2900],10:[3600,3350,3000],15:[5000,4500,4000],20:[6300,5650,5000],30:[7650,7200,6700] },
  400: { 1:[400,350,300],2:[800,700,600],3:[1200,1050,900],4:[1600,1400,1200],5:[1800,1600,1400],6:[2150,1950,1700],7:[2500,2250,1950],8:[2900,2600,2250],9:[3250,2900,2550],10:[3200,2850,2500],15:[4500,4150,3800],20:[5600,5000,4400],30:[7000,6500,6000] },
  350: { 1:[350,300,250],2:[700,600,500],3:[1050,900,750],4:[1400,1200,1000],5:[1600,1450,1250],6:[1900,1700,1500],7:[2250,2000,1750],8:[2550,2300,2000],9:[2900,2600,2250],10:[2800,2550,2300],15:[3950,3500,3000],20:[4900,4450,4000],30:[6600,6200,5800] },
  300: { 1:[300,250,200],2:[600,500,400],3:[900,750,600],4:[1200,1000,800],5:[1350,1200,1000],6:[1600,1400,1200],7:[1900,1650,1400],8:[2150,1900,1600],9:[2450,2150,1800],10:[2500,2250,2000],15:[3400,3100,2800],20:[4200,3900,3600],30:[6300,5850,5400] },
};

function defaultTiers() {
  return TIERS.map((n) => ({ videos: n, anchor: n === 1 ? 300 : 300 * n, medio: n === 1 ? 250 : 250 * n, floor: n === 1 ? 200 : 200 * n }));
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

function waLink(phone) {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

function groupByDate(requests, lang) {
  const groups = {};
  for (const req of requests) {
    const d = req.message_created_at ? new Date(req.message_created_at) : new Date(req.created_at);
    const label = d.toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(req);
  }
  return Object.entries(groups);
}

function RequestCard({ req, onActivate, onReject, onOngoing, F_MONO, t }) {
  const [notSentYet, setNotSentYet] = useState(false);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#141B24", border: "1px solid #232D3A" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontFamily: F_MONO, fontSize: 14, fontWeight: 600 }}>{req.phone}</div>
        <a
          href={waLink(req.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "#25D36622", color: "#25D366" }}
        >
          WhatsApp ↗
        </a>
      </div>
      <div style={{ fontSize: 11, color: "#8B96A5", lineHeight: 1.6 }}>
        {req.product && <div>{t("rc_product")}: {req.product}</div>}
        {req.videos_text && <div>{req.videos_text}</div>}
        {req.price_text && <div>{req.price_text}</div>}
      </div>
      {false && (
        <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "#F2B84B15", color: "#F2B84B" }}>
          {t("rc_cross")}
        </div>
      )}
      <label className="flex items-center gap-2 mt-3 px-1" style={{ fontSize: 11.5, color: "#8B96A5" }}>
        <input type="checkbox" checked={notSentYet} onChange={(e) => setNotSentYet(e.target.checked)} />
        {t("rc_autosend")}
      </label>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onActivate(!notSentYet)}
          className="flex-1 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "#34D399", color: "#06110F" }}
        >
          {t("rc_start")}
        </button>
        <button
          onClick={() => {
            if (!window.confirm(t("rc_collab_confirm", { phone: req.phone }))) return;
            onOngoing();
          }}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "#8AB4F822", color: "#8AB4F8" }}
          title={t("rc_collab_title")}
        >
          {t("rc_collab")}
        </button>
        <button
          onClick={() => {
            if (!window.confirm(t("rc_reject_confirm", { phone: req.phone }))) return;
            onReject();
          }}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "#2A1620", color: "#F19999" }}
        >
          {t("rc_reject")}
        </button>
      </div>
    </div>
  );
}

const MARKET_OPTIONS = ["Spanish-speaking", "English-speaking", "Spanish/English-speaking"];
const emptyScriptFields = { gmvTotal: "", market: "Spanish-speaking", shortName: "", gmv30d: "", tiktokHandle: "" };

/* ═══ ESTE TEXTO NUNCA SE TRADUCE ═══
   Es el mensaje que le llega a la marca. Siempre va en inglés, sin importar en
   qué idioma esté el panel. */
function buildPreviewText(fields, tiers) {
  return openingPreview(fields,tiers);
}

export default function DashboardClient({ targetUserId, isAdminView, isAdmin = false, profile, initialTiers, initialScript, initialLeads, connectionResult }) {
  const [lang, setLang] = useState("es");

  /** Saca el texto en el idioma activo y rellena los {huecos}. */
  const t = (key, vars) => {
    let s = STRINGS[key]?.[lang] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("vaas-lang") : null;
    if (saved === "es" || saved === "en") setLang(saved);
  }, []);

  const switchLang = (l) => {
    setLang(l);
    if (typeof window !== "undefined") localStorage.setItem("vaas-lang", l);
  };

  const [tab, setTab] = useState("whatsapp");
  const router=useRouter();
  const [scriptFields, setScriptFields] = useState({ ...emptyScriptFields, ...(initialScript || {}) });
  const [scriptSaved, setScriptSaved] = useState(true);
  const [approvalRevision,setApprovalRevision]=useState(0);
  const [approvalWarning,setApprovalWarning]=useState('');
  const [savingProfile,setSavingProfile]=useState(false);

  const mergedTiers = defaultTiers().map((d) => {
    const found = (initialTiers || []).find((row) => row.videos === d.videos);
    return found
      ? { videos: d.videos, anchor: Number(found.anchor), medio: found.medio != null ? Number(found.medio) : d.medio, floor: Number(found.floor) }
      : d;
  });
  const [tiers, setTiers] = useState(mergedTiers);
  const [tiersSaved, setTiersSaved] = useState(true);
  const [pricePerVideo, setPricePerVideo] = useState("");
  const [tableUpdated, setTableUpdated] = useState(false);

  const [leads, setLeads] = useState(initialLeads || []);
  useEffect(()=>setLeads(initialLeads || []),[initialLeads]);
  useEffect(()=>{const timer=setInterval(()=>router.refresh(),30000);return()=>clearInterval(timer);},[router]);
  const [phoneInput, setPhoneInput] = useState("");
  const [addCountry, setAddCountry] = useState("other");
  const [leadError, setLeadError] = useState("");
  const [pending, startTransition] = useTransition();
  const [leadFilter, setLeadFilter] = useState("todos");


  const [leadRequests, setLeadRequests] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [importingDay, setImportingDay] = useState(null);
  const [resettingDay, setResettingDay] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [dayStatuses, setDayStatuses] = useState({});
  const [openMonth, setOpenMonth] = useState(null);

  // Conteo en vivo por estado, para las burbujas de filtro.
  const leadCounts = useMemo(() => {
    const counts = { todos: leads.length, [MUTED_KEY]: 0, [COLLAB_KEY]: 0 };
    for (const lead of leads) {
      const key = lead.status || "nuevo";
      counts[key] = (counts[key] || 0) + 1;
      if (mutedInfo(lead)) counts[MUTED_KEY] += 1;
      if (isCollabLead(lead)) counts[COLLAB_KEY] = (counts[COLLAB_KEY] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const visibleFilters = useMemo(
    () => LEAD_FILTERS.filter((f) => f.key === "todos" || (leadCounts[f.key] || 0) > 0),
    [leadCounts]
  );

  const filteredLeads = useMemo(() => {
    if (leadFilter === "todos") return leads;
    // "Sin contestar" no es un status guardado: se calcula comparando fechas.
    if (leadFilter === MUTED_KEY) return leads.filter((l) => mutedInfo(l));
    if (leadFilter === COLLAB_KEY) return leads.filter(isCollabLead);
    return leads.filter((l) => (l.status || "nuevo") === leadFilter);
  }, [leads, leadFilter]);

  // Si el filtro activo se queda sin contactos (por ejemplo borraste el último
  // fallido), se regresa solo a "Todos" para que nunca quede una lista vacía.
  useEffect(() => {
    if (leadFilter !== "todos" && (leadCounts[leadFilter] || 0) === 0) setLeadFilter("todos");
  }, [leadCounts, leadFilter]);

  const loadLeadRequests = useCallback(async () => {
    const data = await listLeadRequests(targetUserId);
    setLeadRequests(data);
  }, [targetUserId]);

  // El admin ve 7 meses hacia atrás para poder retomar contactos viejos; los
  // miembros ven 30 días. El número real lo pone el servidor — esto es solo lo
  // que el navegador pide, y allá se recorta pase lo que pase.
  const loadCalendar = useCallback(async () => {
    const data = await getDiscordCalendar(targetUserId, isAdmin ? 210 : 30);
    setCalendar(data);
  }, [targetUserId, isAdmin]);

  const loadDayStatuses = useCallback(async () => {
    const data = await getDayStatuses(targetUserId);
    setDayStatuses(data || {});
  }, [targetUserId]);

  useEffect(() => {
    if (tab !== "legacy-review") return;
    setCalendarLoading(true);
    Promise.all([loadLeadRequests(), loadCalendar(), loadDayStatuses()]).then(() => setCalendarLoading(false));
  }, [tab, loadLeadRequests, loadCalendar, loadDayStatuses]);

  const doImportDay = (dateStr) => {
    setImportingDay(dateStr);
    startTransition(async () => {
      await importDay(targetUserId, dateStr);
      setImportingDay(null);
      loadLeadRequests();
      loadDayStatuses();
    });
  };

  const doResetDay = (dateStr, label) => {
    const confirmed = window.confirm(t("reset_day_confirm", { day: label }));
    if (!confirmed) return;
    setResettingDay(dateStr);
    setResetResult(null);
    startTransition(async () => {
      const res = await resetDayRequests(targetUserId, dateStr);
      setResettingDay(null);
      setResetResult({ dateStr, ...res });
      loadLeadRequests();
      loadCalendar();
      loadDayStatuses();
    });
  };

  const doSaveScript = async () => {
      setSavingProfile(true);
      try {const result=await saveScript(targetUserId, scriptFields);setScriptSaved(true);setApprovalWarning(result?.warning||'');setApprovalRevision(n=>n+1);}
      catch(error){window.alert(error.message);}
      finally{setSavingProfile(false);}
  };

  const doSavePricing = async () => {
      setSavingProfile(true);
      try {const result=await savePricing(targetUserId, tiers);setTiersSaved(true);setApprovalWarning(result?.warning||'');setApprovalRevision(n=>n+1);}
      catch(error){window.alert(error.message);}
      finally{setSavingProfile(false);}
  };

  const applyPriceTable = () => {
    const price = Number(pricePerVideo);
    if (!price) return;
    const availableTiers = Object.keys(PRICE_TABLES).map(Number);
    const closest = availableTiers.reduce((prev, curr) =>
      Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
    );
    const table = PRICE_TABLES[closest];
    const updated = tiers.map((tier) => {
      const row = table[tier.videos];
      if (!row) return tier;
      const [anchor, medio, floor] = row;
      return { ...tier, anchor, medio, floor };
    });
    setTiers(updated);
    setTiersSaved(false);
    setTableUpdated(true);
    setTimeout(() => setTableUpdated(false), 2500);
  };

  const [needsAutoSend, setNeedsAutoSend] = useState(false);
  const [expandedConvo, setExpandedConvo] = useState(null);

  const doAddLead = () => {
    if (!phoneInput.trim()) return;
    const normalized = normalizePhoneForCountry(phoneInput, addCountry);
    const skipMessage1 = !needsAutoSend;
    startTransition(async () => {
      const res = await addLead(targetUserId, normalized, skipMessage1);
      if (res?.error) {
        setLeadError(res.error);
      } else {
        setLeadError("");
        setPhoneInput("");
        setLeads((leads) => res.lead ? [res.lead, ...leads.filter(l=>l.id!==res.lead.id)] : leads);
        router.refresh();
      }
    });
  };

  const doRestartLead = (leadId) => {
    startTransition(async()=>{try{await restartLead(targetUserId,leadId);router.refresh();}catch(e){setLeadError(e.message);}});
  };
  const doReiniciarFallido = (lead) => {doRestartLead(lead.id);};

  // "Ya tengo colaboración con este número": lo deja cerrado y pausado, y el bot
  // ya nunca le escribe. Sirve tanto para un contacto que ya está en la cola como
  // para un número que nunca ha estado — así lo registras antes de mandarle nada.
  const doMarkCollab = (phoneRaw, leadId = null) => {
    startTransition(async () => {
      const res = await markAsCollab(targetUserId, phoneRaw);
      if (res?.error) {
        window.alert(t("collab_save_error", { err: res.error }));
        return;
      }
      setLeadError("");
      if (leadId) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, status: "cerrado", paused: true, negotiation: { ...(l.negotiation || {}), manualCollab: true } }
              : l
          )
        );
      } else {
        setPhoneInput("");
        setLeads((prev) => {
          const digits = (phoneRaw || "").replace(/[^0-9]/g, "");
          const yaEsta = prev.some((l) => (l.phone || "").replace(/[^0-9]/g, "") === digits);
          if (yaEsta) {
            return prev.map((l) =>
              (l.phone || "").replace(/[^0-9]/g, "") === digits
                ? { ...l, status: "cerrado", paused: true, negotiation: { ...(l.negotiation || {}), manualCollab: true } }
                : l
            );
          }
          return prev;
        });
        router.refresh();
      }
    });
  };

  const doResolveLead = (leadId) => {
    if (!confirm(t("resolve_confirm"))) return;
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    startTransition(() => resolveLeadManually(targetUserId, leadId));
  };

  // skipMessage1 ahora viene del checkbox real de cada tarjeta (RequestCard),
  // en vez de estar fijo en "true" — así el bot manda el template automáticamente
  // cuando Irving NO marcó que ya lo mandó a mano.
  //
  // PROTECCIÓN: si ya hay historial con ese número (chat del bot o trato cerrado),
  // el servidor NO activa nada y regresa el detalle. Aquí se le enseña a Irving y
  // él decide: OK = reiniciar y darle otra vuelta; Cancelar = no hacer nada (y si
  // ya tiene colaboración, usa el botón "Ya tengo colab" de la misma tarjeta).
  // Y si algo falla, el motivo SIEMPRE se muestra — nada de fallar en silencio.
  const doActivateRequest = (req, skipMessage1) => {
    startTransition(async () => {
      const applySuccess = () => {
        setLeadRequests((prev) => prev.filter((r) => r.id !== req.id));
        router.refresh();
        loadDayStatuses();
      };

      const res = await activateLeadRequest(targetUserId, req.id, req.phone, skipMessage1);

      if (res?.needsDecision) {
        const seguir = window.confirm(t("activate_history", { phone: req.phone, summary: res.history.summary }));
        if (!seguir) return;
        const res2 = await activateLeadRequest(targetUserId, req.id, req.phone, skipMessage1, true);
        if (res2?.error) {
          window.alert(t("activate_error", { phone: req.phone, err: res2.error }));
          return;
        }
        applySuccess();
        return;
      }

      if (res?.error) {
        window.alert(t("activate_error", { phone: req.phone, err: res.error }));
        return;
      }

      applySuccess();
    });
  };

  const doRejectRequest = (reqId) => {
    setLeadRequests((prev) => prev.filter((r) => r.id !== reqId));
    startTransition(async () => {
      await rejectLeadRequest(targetUserId, reqId);
      loadDayStatuses();
    });
  };

  const doOngoingRequest = (reqId) => {
    setLeadRequests((prev) => prev.filter((r) => r.id !== reqId));
    startTransition(async () => {
      await markOngoingRequest(targetUserId, reqId);
      loadDayStatuses();
    });
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const F_DISPLAY = "'Space Grotesk', sans-serif";
  const F_MONO = "'IBM Plex Mono', monospace";

  // El calendario agrupado por mes. Con 7 meses de historial son ~200 burbujas
  // de días, un muro imposible de leer — así le picas al mes y solo se abren sus
  // días. Cada mes trae cuántos contactos tiene en total y cuántos siguen
  // pendientes de revisar.
  const calendarByMonth = useMemo(() => {
    const map = new Map();
    for (const day of calendar || []) {
      const key = String(day.date || "").slice(0, 7);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { key, days: [], total: 0, pending: 0 });
      const g = map.get(key);
      g.days.push(day);
      g.total += Number(day.count || 0);
      const st = dayStatuses[day.date];
      if (st && st.pending > 0) g.pending += st.pending;
    }
    const list = [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
    for (const g of list) g.days.sort((a, b) => (a.date < b.date ? 1 : -1));
    return list;
  }, [calendar, dayStatuses]);

  const monthLabel = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });
  };

  const activeMonth = openMonth ?? calendarByMonth[0]?.key ?? null;

  const groupedRequests = groupByDate(leadRequests, lang);

  return (
    <div className="min-h-screen w-full pb-16" style={{ background: "#0B0E14", color: "#EDEFF2" }}>
      {isAdminView && (
        <div className="px-5 py-2 flex items-center justify-center gap-3 text-xs" style={{ background: "#F2B84B22", color: "#F2B84B" }}>
          <span className="truncate">{t("viewing_as", { name: profile?.name || profile?.email || "" })}</span>
          {/* Estando dentro de la cuenta de alguien más, el botón de "Salir" se
              esconde y no quedaba forma de regresar sin usar el atrás del
              navegador. Este botón siempre está a la vista. */}
          <button
            onClick={() => (window.location.href = "/admin")}
            className="px-2 py-1 rounded-lg font-semibold whitespace-nowrap flex-shrink-0"
            style={{ background: "#F2B84B", color: "#1A1608" }}
          >
            {t("back_to_admin")}
          </button>
        </div>
      )}

      <div className="px-5 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1B2430" }}>
        <div className="min-w-0">
          <h1 style={{ fontFamily: F_DISPLAY, fontWeight: 700, fontSize: 22 }}>VAAS Closer Bot</h1>
          <div className="truncate" style={{ fontSize: 12, color: "#8B96A5" }}>{profile?.name || profile?.email}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => switchLang(lang === "es" ? "en" : "es")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#141B24", border: "1px solid #232D3A", color: "#22D3C0" }}
            title={lang === "es" ? "Switch to English" : "Cambiar a español"}
          >
            {lang === "es" ? "EN" : "ES"}
          </button>
          {!isAdminView && (
            <button onClick={signOut} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5" }}>
              {t("sign_out")}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 flex gap-2 flex-wrap">
        {[
          ["whatsapp", "tab_whatsapp"],
          ["escrito", "tab_escrito"],
          ["precios", "tab_precios"],
          ["cola", "tab_cola"],
          ["contacts", "tab_revision"],
        ].map(([key, labelKey]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={tab === key ? { background: "#22D3C0", color: "#06110F" } : { background: "#141B24", color: "#8B96A5", border: "1px solid #232D3A" }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === "whatsapp" && <>
        {connectionResult==='retry' && <p role="alert" className="mx-5 mt-4 text-amber-300 text-sm">La conexión no se completó. Vuelve a conectar WhatsApp desde aquí.</p>}
        {connectionResult==='success' && <p className="mx-5 mt-4 text-emerald-300 text-sm">Número conectado. Revisa los pasos pendientes antes de activar tu bot.</p>}
        <ConnectionCard userId={targetUserId} lang={lang} onProfile={()=>setTab('escrito')} onPrices={()=>setTab('precios')} />
      </>}

      {(tab === "contacts" || tab === "revision") && <AutopilotPanel userId={targetUserId}/>}

      {tab === "escrito" && (
        <div className="px-5 pt-4">
          <div className="mb-4"><ScriptApproval userId={targetUserId} revision={approvalRevision} lang={lang} unsaved={!scriptSaved||!tiersSaved}/></div>
          {approvalWarning&&<p role="alert" className="mb-3 text-sm text-amber-200">{approvalWarning}</p>}
          <div style={{ fontSize: 12, color: "#8B96A5", marginBottom: 12 }}>
            {t("script_intro")}
          </div>

          <div className="flex flex-col gap-3">
            <Field label={t("f_gmv_total")}>
              <input value={scriptFields.gmvTotal} onChange={(e) => { setScriptFields({ ...scriptFields, gmvTotal: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="2M" />
            </Field>
            <Field label={t("f_market")}>
              <select
                value={scriptFields.market}
                onChange={(e) => { setScriptFields({ ...scriptFields, market: e.target.value }); setScriptSaved(false); }}
                style={inputStyle}
              >
                {MARKET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label={t("f_shortname")}>
              <input value={scriptFields.shortName} onChange={(e) => { setScriptFields({ ...scriptFields, shortName: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="Irving" />
            </Field>
            <Field label={t("f_gmv30")}>
              <input value={scriptFields.gmv30d} onChange={(e) => { setScriptFields({ ...scriptFields, gmv30d: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder="100k" />
            </Field>
            <Field label={t("f_tiktok")}>
              <input value={scriptFields.tiktokHandle} onChange={(e) => { setScriptFields({ ...scriptFields, tiktokHandle: e.target.value }); setScriptSaved(false); }} style={inputStyle} placeholder={t("ph_tiktok")} />
            </Field>
          </div>

          <button
            onClick={doSaveScript}
            disabled={pending || savingProfile}
            className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: scriptSaved ? "#141B24" : "#22D3C0", color: scriptSaved ? "#8B96A5" : "#06110F", border: scriptSaved ? "1px solid #232D3A" : "none" }}
          >
            {savingProfile?(lang==='en'?'Saving and checking approval…':'Guardando y consultando aprobación…'):scriptSaved ? t("saved_check") : t("save_script")}
          </button>

          <div style={{ fontSize: 11, color: "#8B96A5", marginTop: 20, marginBottom: 8 }}>{t("preview_label")}</div>
          <div
            className="w-full rounded-xl p-3 text-xs whitespace-pre-wrap"
            style={{ background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5", fontFamily: F_MONO, lineHeight: 1.6 }}
          >
            {buildPreviewText(scriptFields, tiers)}
          </div>
          <p className="mt-2 text-xs text-slate-400">{lang==='es'?'Plantilla':'Template'}: <code>{OPENING_NAME}</code> · English</p>
          <p className="mt-2 text-xs text-slate-400">{lang==='es'?'Los importes salen del precio inicial (anchor) de 1, 5 y 10 videos en Precios. Los valores medio y mínimo se reservan para la negociación.':'Amounts use the saved opening prices (anchor) for 1, 5 and 10 videos. Mid and floor prices are used during negotiation.'}</p>
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold">{lang==='es'?'Mensaje de seguimiento':'Follow-up message'}</p>
            <p className="mt-2 text-sm">{FOLLOWUP_BODY}</p>
            <p className="mt-2 text-xs text-slate-400">{lang==='es'?'Plantilla':'Template'}: <code>{FOLLOWUP_NAME}</code> · English</p>
          </div>
        </div>
      )}

      {tab === "precios" && (
        <div className="px-5 pt-4">
          {approvalWarning&&<p role="alert" className="mb-3 text-sm text-amber-200">{approvalWarning}</p>}
          <div className="rounded-xl p-4 mb-4" style={{ background: "#141B24", border: "1px solid #22D3C0" }}>
            <div style={{ fontSize: 12, color: "#8B96A5", marginBottom: 8 }}>
              {t("price_intro")}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center rounded-lg px-2.5" style={{ background: "#0B0E14", border: "1px solid #232D3A" }}>
                <span style={{ fontSize: 13, color: "#8B96A5" }}>$</span>
                <input
                  type="number"
                  value={pricePerVideo}
                  onChange={(e) => setPricePerVideo(e.target.value)}
                  placeholder={t("ph_price")}
                  className="bg-transparent outline-none flex-1 px-1.5 py-2 text-sm"
                  style={{ color: "#EDEFF2", fontFamily: F_MONO }}
                />
                <span style={{ fontSize: 11, color: "#8B96A5" }}>{t("per_video")}</span>
              </div>
              <button
                onClick={applyPriceTable}
                className="px-4 rounded-lg text-sm font-semibold whitespace-nowrap"
                style={{ background: tableUpdated ? "#34D399" : "#22D3C0", color: "#06110F" }}
              >
                {tableUpdated ? t("updated_check") : t("update_table")}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#8B96A5", marginBottom: 10 }}>{t("tiers_intro")}</div>
          <div className="flex flex-col gap-2 mb-3">
            {tiers.map((tr, i) => (
              <div key={tr.videos} className="flex items-center gap-2 flex-wrap">
                <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ width: 62, background: "#141B24", border: "1px solid #232D3A", color: "#8B96A5" }}>
                  {tr.videos} {tr.videos === 1 ? t("vid_short") : t("vids_short")}
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 11, color: "#8B96A5" }}>{t("high_label")}</span>
                  <input
                    type="number"
                    value={tr.anchor}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTiers((prev) => prev.map((p, idx) => (idx === i ? { ...p, anchor: v } : p)));
                      setTiersSaved(false);
                    }}
                    style={{ width: 68, background: "#0B0E14", border: "1px solid #232D3A", borderRadius: 8, padding: "5px 6px", fontFamily: F_MONO, fontSize: 12, color: "#F2B84B" }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 11, color: "#8B96A5" }}>{t("mid_label")}</span>
                  <input
                    type="number"
                    value={tr.medio ?? ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTiers((prev) => prev.map((p, idx) => (idx === i ? { ...p, medio: v } : p)));
                      setTiersSaved(false);
                    }}
                    style={{ width: 68, background: "#0B0E14", border: "1px solid #232D3A", borderRadius: 8, padding: "5px 6px", fontFamily: F_MONO, fontSize: 12, color: "#8AB4F8" }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 11, color: "#8B96A5" }}>{t("floor_label")}</span>
                  <input
                    type="number"
                    value={tr.floor}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTiers((prev) => prev.map((p, idx) => (idx === i ? { ...p, floor: v } : p)));
                      setTiersSaved(false);
                    }}
                    style={{ width: 68, background: "#0B0E14", border: "1px solid #232D3A", borderRadius: 8, padding: "5px 6px", fontFamily: F_MONO, fontSize: 12, color: "#34D399" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={doSavePricing}
            disabled={pending || savingProfile}
            className="w-full py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: tiersSaved ? "#141B24" : "#22D3C0", color: tiersSaved ? "#8B96A5" : "#06110F", border: tiersSaved ? "1px solid #232D3A" : "none" }}
          >
            {savingProfile?(lang==='en'?'Saving and checking approval…':'Guardando y consultando aprobación…'):tiersSaved ? t("saved_check") : t("save_pricing")}
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
                placeholder={t("ph_phone")}
                className="bg-transparent outline-none flex-1 text-sm"
                style={{ color: "#EDEFF2", fontFamily: F_MONO }}
              />
              {phoneInput.replace(/[^0-9]/g, "").length >= 7 && (
                <a
                  href={waLink(normalizePhoneForCountry(phoneInput, addCountry))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap"
                  style={{ background: "#25D36622", color: "#25D366" }}
                  title={t("wa_open_title")}
                >
                  WhatsApp ↗
                </a>
              )}
            </div>
            <button
              onClick={() => setAddCountry((c) => (c === "other" ? "china" : c === "china" ? "us" : "other"))}
              className="px-3 rounded-xl text-xs font-semibold"
              style={
                addCountry === "us"
                  ? { background: "#22D3C022", color: "#22D3C0", border: "1px solid #22D3C0" }
                  : addCountry === "other"
                  ? { background: "#8B96A522", color: "#8B96A5", border: "1px solid #8B96A5" }
                  : { background: "#F2B84B22", color: "#F2B84B", border: "1px solid #F2B84B" }
              }
              title={t("country_title")}
            >
              {addCountry === "us" ? "US" : addCountry === "other" ? t("country_other") : "CN"}
            </button>
            <button onClick={doAddLead} className="px-4 rounded-xl text-sm font-semibold" style={{ background: "#22D3C0", color: "#06110F" }}>
              {t("add_btn")}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 mt-2 px-1">
            <label className="flex items-center gap-2" style={{ fontSize: 11.5, color: "#8B96A5" }}>
              <input
                type="checkbox"
                checked={needsAutoSend}
                onChange={(e) => setNeedsAutoSend(e.target.checked)}
              />
              {t("autosend_label")}
            </label>
            {phoneInput.replace(/[^0-9]/g, "").length >= 7 && (
              <button
                onClick={() => {
                  const normalized = normalizePhoneForCountry(phoneInput, addCountry);
                  if (!window.confirm(t("collab_confirm", { phone: normalized }))) return;
                  doMarkCollab(normalized);
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap flex-shrink-0"
                style={{ background: "#34D39922", color: "#34D399", border: "1px solid #34D39955" }}
                title={t("already_collab_title")}
              >
                {t("already_collab_btn")}
              </button>
            )}
          </div>
          {leadError && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#2A1620", color: "#F19999", border: "1px solid #4A2530" }}>
              {leadError}
            </div>
          )}

          {leads.length > 0 && (
            <div className="mt-4 flex gap-1.5 flex-wrap">
              {visibleFilters.map((f) => {
                const count = leadCounts[f.key] || 0;
                const active = leadFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setLeadFilter(f.key)}
                    className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full text-[11px] font-semibold"
                    style={
                      active
                        ? { background: f.color, color: "#06110F", border: `1px solid ${f.color}` }
                        : { background: "#141B24", color: f.color, border: `1px solid ${f.color}38` }
                    }
                  >
                    {t(f.label)}
                    <span
                      className="px-1.5 rounded-full text-[10px] font-bold"
                      style={active ? { background: "#06110F22", color: "#06110F" } : { background: `${f.color}1F`, color: f.color }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {leads.length === 0 && (
              <div className="text-sm text-center py-10" style={{ color: "#8B96A5" }}>
                {t("empty_queue")}
              </div>
            )}
            {leads.length > 0 && filteredLeads.length === 0 && (
              <div className="text-sm text-center py-10" style={{ color: "#8B96A5" }}>
                {t("empty_filter")}
              </div>
            )}
            {filteredLeads.map((lead) => {
              const idx = stageIndex(lead.status);
              const isCross = lead.status === "cruzado";
              const isFailed = lead.status === "fallido";
              const isDormant = lead.status === "dormant";
              const isCheckback = lead.status === "checkback";
              const muted = mutedInfo(lead);
              const isCollab = isCollabLead(lead);
              const fecha = leadDate(lead, lang);
              return (
                <div
                  key={lead.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "#141B24",
                    border: muted
                      ? "1px solid #FF5C5C"
                      : isCollab
                      ? "1px solid #34D39966"
                      : isCheckback
                      ? "1px solid #8AB4F855"
                      : isFailed
                      ? "1px solid #F19999"
                      : isCross
                      ? "1px solid #F2B84B"
                      : lead.paused
                      ? "1px solid #F2B84B"
                      : "1px solid #232D3A",
                    boxShadow: muted ? "0 0 0 1px #FF5C5C33, 0 0 14px #FF5C5C22" : "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div style={{ fontFamily: F_MONO, fontSize: 14, fontWeight: 600 }}>{lead.phone}</div>
                      {fecha && (
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                          style={{ background: "#0B0E14", color: "#6B7684", fontFamily: F_MONO, border: "1px solid #1B2430" }}
                          title={t("last_activity", { when: fecha.full })}
                        >
                          {fecha.short}
                        </span>
                      )}
                      <a
                        href={waLink(lead.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                        style={{ background: "#25D36622", color: "#25D366" }}
                        title={t("open_wa_title")}
                      >
                        WhatsApp ↗
                      </a>
                      {lead.conversation?.length > 0 && (
                        <button
                          onClick={() => setExpandedConvo((prev) => (prev === lead.id ? null : lead.id))}
                          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                          style={{ background: "#8AB4F822", color: "#8AB4F8" }}
                          title={t("view_chat_title")}
                        >
                          {expandedConvo === lead.id ? t("hide_chat") : t("view_chat")}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {isFailed ? (
                        <button
                          onClick={() => doReiniciarFallido(lead)}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: "#F1999922", color: "#F19999" }}
                          title={t("restart_failed_title")}
                        >
                          {t("restart")}
                        </button>
                      ) : isCross ? (
                        <>
                          <button
                            onClick={() => doRestartLead(lead.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: "#22D3C022", color: "#22D3C0" }}
                            title={t("restart_cross_title")}
                          >
                            {t("restart")}
                          </button>
                          <button
                            onClick={() => doResolveLead(lead.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: "#34D39922", color: "#34D399" }}
                            title={t("mark_resolved_title")}
                          >
                            {t("mark_resolved")}
                          </button>
                        </>
                      ) : isDormant || isCheckback ? (
                        <button
                          onClick={() => doRestartLead(lead.id)}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: "#22D3C022", color: "#22D3C0" }}
                          title={t("restart_sleep_title")}
                        >
                          {t("restart")}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const next = !lead.paused;
                            setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, paused: next } : l)));
                            startTransition(() => toggleLeadPause(targetUserId, lead.id, next));
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: lead.paused ? "#F2B84B22" : "#1B2430", color: lead.paused ? "#F2B84B" : "#8B96A5" }}
                        >
                          {lead.paused ? t("paused") : t("pause")}
                        </button>
                      )}
                      {!isFailed && !isCollab && (
                        <button
                          onClick={() => {
                            if (!window.confirm(t("collab_card_confirm", { phone: lead.phone }))) return;
                            doMarkCollab(lead.phone, lead.id);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: "#34D39922", color: "#34D399" }}
                          title={t("collab_short_title")}
                        >
                          {t("collab_short")}
                        </button>
                      )}
                      {!isFailed && (
                        <button
                          onClick={() => {
                            setLeads((prev) => prev.filter((l) => l.id !== lead.id));
                            startTransition(() => removeLead(targetUserId, lead.id));
                          }}
                          className="px-2 py-1 rounded-lg text-[10px]"
                          style={{ background: "#1B2430", color: "#8B96A5" }}
                        >
                          {t("delete_btn")}
                        </button>
                      )}
                    </div>
                  </div>
                  {isCollab && (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "#34D39915", color: "#34D399", border: "1px solid #34D39944" }}>
                      {t("collab_banner")}
                    </div>
                  )}
                  {muted && (
                    <div
                      className="mt-2 px-2.5 py-2 rounded-lg text-[11px]"
                      style={{ background: "#FF5C5C1A", color: "#FF9E9E", border: "1px solid #FF5C5C55" }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {t("muted_title", { hours: muted.hours })}
                      </div>
                      <div style={{ marginTop: 3, lineHeight: 1.5 }}>
                        {muted.windowClosed ? t("muted_closed") : t("muted_open")}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <a
                          href={waLink(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                          style={{ background: "#25D36622", color: "#25D366" }}
                        >
                          {t("reply_on_wa")}
                        </a>
                        <button
                          onClick={() => {
                            if (!window.confirm(t("ill_handle_confirm", { phone: lead.phone }))) return;
                            setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, paused: true } : l)));
                            startTransition(() => toggleLeadPause(targetUserId, lead.id, true));
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                          style={{ background: "#8AB4F822", color: "#8AB4F8" }}
                          title={t("ill_handle_title")}
                        >
                          {t("ill_handle_it")}
                        </button>
                      </div>
                    </div>
                  )}
                  {isFailed || lead.last_error ? (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "#2A1620", color: "#F19999" }}>
                      ❌ {lead.last_error || t("delivery_failed")}
                    </div>
                  ) : isCross ? (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "#F2B84B15", color: "#F2B84B" }}>
                      {t("cross_banner")}
                    </div>
                  ) : isCheckback ? (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "#8AB4F815", color: "#8AB4F8" }}>
                      {t("checkback_banner", { n: Number(lead.negotiation?.checkbackCount || 0) })}
                    </div>
                  ) : isDormant ? (
                    (() => {
                      // A los 30 días el bot le da UNA segunda vuelta, pero solo a
                      // quien nunca contestó nada. Si la marca llegó a escribir
                      // (aunque haya sido un "no"), ya no se le vuelve a escribir.
                      const contestaron = (lead.conversation || []).some((m) => m.role === "user");
                      const yaTuvoSegunda = !!lead.dormant_followup_sent;
                      const base = lead.last_outbound_at ? new Date(lead.last_outbound_at).getTime() : null;
                      const faltan = base ? Math.max(0, 30 - Math.floor((Date.now() - base) / 86400000)) : null;
                      const revive = !contestaron && !yaTuvoSegunda;
                      const cuando =
                        faltan === 0 || faltan == null
                          ? t("dormant_next_send")
                          : t("dormant_in_days", { n: faltan, s: faltan === 1 ? "" : "s" });
                      return (
                        <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "#1B2430", color: revive ? "#8AB4F8" : "#8B96A5" }}>
                          {revive ? t("dormant_revive", { when: cuando }) : contestaron ? t("dormant_answered") : t("dormant_done")}
                        </div>
                      );
                    })()
                  ) : (
                    <>
                      <div className="mt-3 flex items-center">
                        {STAGES.map((s, i) => (
                          <div key={s.key} className="flex items-center flex-1">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: i <= idx ? (s.key === "cerrado" ? "#34D399" : "#22D3C0") : "#232D3A" }} title={t(s.label)} />
                            {i < STAGES.length - 1 && <div className="flex-1 h-[2px]" style={{ background: i < idx ? "#22D3C0" : "#232D3A" }} />}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span style={{ fontSize: 11, color: "#8B96A5" }}>
                          {t(STAGES[idx].label)}
                          {lead.status === "followup" && lead.followup_count > 0 ? ` ${lead.followup_count}/4` : ""}
                          {lead.status === "negociando" && lead.negotiation?.waiting
                            ? `${t("waiting_brand")}${Number(lead.negotiation.waitingNudges || 0) > 0 ? t("waiting_day", { n: lead.negotiation.waitingNudges }) : ""}`
                            : ""}
                        </span>
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
                            {t("mark_next", { stage: t(STAGES[idx + 1].label) })}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {expandedConvo === lead.id && (
                    <div
                      className="mt-3 pt-3 flex flex-col gap-2 max-h-72 overflow-y-auto"
                      style={{ borderTop: "1px solid #232D3A" }}
                    >
                      {(lead.conversation || []).map((m, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1.5 rounded-lg text-[11.5px] max-w-[85%]"
                          style={
                            m.role === "assistant"
                              ? { background: "#22D3C022", color: "#EDEFF2", alignSelf: "flex-end" }
                              : { background: "#0B0E14", color: "#EDEFF2", alignSelf: "flex-start", border: "1px solid #232D3A" }
                          }
                        >
                          {m.content}
                        </div>
                      ))}
                    </div>
                  )}
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
