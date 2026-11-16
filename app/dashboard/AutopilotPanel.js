'use client';
import {useEffect,useState,useCallback,useMemo} from 'react';
import {automationStatus,saveAutomation,syncContacts,decideContact} from './whatsapp-client';
const button='rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40';
const labels={queued:'En cola',review:'Revisar',active:'En proceso',skipped:'Archivado',collaborated:'Ya colaboré',blocked:'No contactar'};
const formatDate=value=>value?new Date(value).toLocaleString('es-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Pendiente';

export function AutomationSetup({userId,onSaved}) {
 const [consent,setConsent]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;automationStatus(userId).then(r=>{if(live){setConsent(r.settings.consent);setLoaded(true);}}).catch(e=>{if(live)setMessage(e.message);});return()=>{live=false;};},[userId]);
 return <div className="space-y-3">
  <p className="text-sm text-slate-400">Importa los contactos disponibles de la comunidad y revisa los nuevos cada día, aunque cierres esta página.</p>
  <p className="text-sm font-semibold">Contactos de los últimos 30 días</p>
  <label className="flex gap-3 items-start text-sm text-slate-300"><input type="checkbox" className="mt-1 accent-teal-400" checked={consent} disabled={!loaded||busy} onChange={e=>setConsent(e.target.checked)}/><span>Confirmo que estos contactos dieron permiso para recibir mensajes de colaboración de mi negocio por WhatsApp. Estar en una lista no sustituye ese permiso.</span></label>
  <button className={`${button} bg-slate-800`} disabled={!loaded||busy} onClick={async()=>{setBusy(true);setMessage('');try{await saveAutomation(userId,30,consent);setMessage('Preferencias guardadas');await onSaved?.();}catch(e){setMessage(e.message);}finally{setBusy(false);}}}>{busy?'Guardando…':'Guardar preferencias'}</button>
  {message&&<p role="status" className="text-sm text-teal-200">{message}</p>}
 </div>;
}

export default function AutopilotPanel({userId}) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(1),[confirm,setConfirm]=useState(null);
 const refresh=useCallback(async()=>{try{setData(await automationStatus(userId));setError('');}catch(e){setError(e.message);}},[userId]);
 useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[refresh]);
 useEffect(()=>{setPage(1);},[filter,query]);
 const filtered=useMemo(()=>(data?.contacts||[]).filter(c=>(filter==='all'||c.state===filter)&&`${c.phone} ${c.product}`.toLowerCase().includes(query.toLowerCase())),[data,filter,query]);
 async function run(key,fn){setBusy(key);setError('');try{setData(await fn());setConfirm(null);}catch(e){setError(e.message);}finally{setBusy('');}}
 return <section className="px-5 py-5 space-y-5" aria-label="Contactos automáticos">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Tus contactos</h2><p className="text-sm text-slate-400 mt-1">Un primer mensaje por minuto. Tú decides sobre los contactos con historial.</p></div><button disabled={!!busy} className={`${button} bg-slate-800`} onClick={()=>run('sync',()=>syncContacts(userId))}>{busy==='sync'?'Importando…':'Actualizar contactos'}</button></div>
  {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {data?.settings.error&&<p role="status" className="rounded-xl bg-amber-950 p-3 text-sm text-amber-200">{data.settings.error}</p>}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['queued','Por iniciar'],['review','Necesitan revisión'],['active','En proceso'],['collaborated','Colaboraciones']].map(([key,label])=><button key={key} onClick={()=>setFilter(key)} className={`rounded-2xl border p-4 text-left ${filter===key?'border-teal-400 bg-teal-950':'border-slate-700 bg-slate-900'}`}><span className="text-2xl font-semibold">{data?.counts[key]??'—'}</span><span className="block text-xs text-slate-400 mt-1">{label}</span></button>)}</div>
  <p className="text-xs text-slate-400">Última importación: {formatDate(data?.settings.lastSync)} · Últimos 30 días · Horario de primeros mensajes: 8 pm a 8 am, hora de Chicago, noches de domingo a jueves.</p>
  <div className="flex flex-wrap gap-3"><input aria-label="Buscar contacto" placeholder="Buscar número o producto" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"/><select aria-label="Filtrar contactos" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl bg-slate-800 px-3 py-2"><option value="all">Todos</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
  {!data?<p role="status" className="text-sm text-slate-400">Cargando tus contactos…</p>:!filtered.length?<div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center"><p>No hay contactos en esta vista.</p><p className="mt-2 text-sm text-slate-400">Puedes importar y revisar antes de activar. Los envíos comienzan cuando tu conexión y el bot están listos.</p></div>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.slice((page-1)*24,page*24).map(c=><article key={c.phone} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 flex flex-col gap-3">
   <div className="flex items-start justify-between gap-2"><span className="font-mono text-sm">+{c.phone}</span><span className={`rounded-full px-2 py-1 text-xs ${c.state==='review'?'bg-amber-950 text-amber-300':'bg-slate-800 text-teal-200'}`}>{labels[c.state]}</span></div>
   <p className="text-sm line-clamp-2 min-h-5">{c.product||'Colaboración'}</p>
   {c.reason&&<p className="text-xs text-amber-200">{c.reason}</p>}
   {c.lead?.last_outbound_at?<p className="text-xs text-slate-400">Último envío registrado: {formatDate(c.lead.last_outbound_at)}</p>:<p className="text-xs text-slate-400">{c.history_source?'Historial detectado en tu cuenta':'Sin historial disponible en el sistema'}</p>}
   {c.lead?.last_error&&<p className="text-xs text-amber-200">{c.lead.last_error}</p>}
   <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-300">Abrir conversación en WhatsApp ↗</a>
   <div className="mt-auto text-sm"><p className="text-slate-300 py-1">Decidir sobre este contacto</p><div className="flex flex-wrap gap-2 pt-3">
    <button disabled={!!busy||!data.settings.consent||['active','blocked'].includes(c.state)} className={`${button} bg-teal-400 text-slate-950`} onClick={()=>setConfirm(c)}>Enviar primer mensaje</button>
    <button disabled={!!busy||['collaborated','blocked'].includes(c.state)} className={`${button} bg-slate-800`} onClick={()=>run(c.phone,()=>decideContact(userId,c.phone,'collaborated'))}>Ya colaboré</button>
    <button disabled={!!busy||['skipped','blocked'].includes(c.state)} className={`${button} bg-slate-800`} onClick={()=>run(c.phone,()=>decideContact(userId,c.phone,'skipped'))}>Archivar</button>
   </div></div>
  </article>)}</div>}
  {filtered.length>24&&<div className="flex justify-center items-center gap-3"><button className={`${button} bg-slate-800`} disabled={page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span className="text-sm">{page} / {Math.ceil(filtered.length/24)}</span><button className={`${button} bg-slate-800`} disabled={page*24>=filtered.length} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>}
  <p className="text-xs text-slate-500">Al conectar WhatsApp Business, revisamos las conversaciones que se sincronizan, incluidas las archivadas. Si ya hay conversación, pasa a revisión sin enviar. El historial disponible puede estar incompleto; el de otros miembros no bloquea tus contactos. Archivar aquí retira el contacto de la cola de Closer, no del WhatsApp del teléfono.</p>
  {confirm&&<div role="dialog" aria-modal="true" aria-label="Confirmar primer mensaje" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"><div className="max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6"><h3 className="font-semibold">Enviar a +{confirm.phone}</h3><p className="text-sm text-slate-300 mt-3">Confirma que revisaste la conversación y quieres enviar el primer mensaje. Entrará a la cola con el ritmo de un minuto y el horario configurado.</p><div className="flex gap-3 mt-5"><button className={`${button} bg-teal-400 text-slate-950`} disabled={!!busy} onClick={()=>run(confirm.phone,()=>decideContact(userId,confirm.phone,'send'))}>Poner en cola</button><button className={`${button} bg-slate-800`} disabled={!!busy} onClick={()=>setConfirm(null)}>Volver</button></div></div></div>}
 </section>;
}
