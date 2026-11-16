'use client';
import {useEffect,useState,useCallback} from 'react';
import {connectWhatsapp,whatsappStatus,resetWhatsapp,setBotEnabled,prepareWhatsappTemplates} from './whatsapp-actions';
import {AutomationSetup} from './AutopilotPanel';

export default function ConnectionCard({userId,onProfile,onPrices}) {
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mode,setMode]=useState('business_app');
  const refresh=useCallback(async()=>{
    try{const result=await whatsappStatus(userId);setState(result);setError('');}
    catch(e){setError(e.message);}
  },[userId]);
  useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[refresh]);
  async function run(action){setBusy(true);setError('');try{await action();}catch(e){setError(e.message);}finally{setBusy(false);}}
  if(!state) return <section className="px-5 py-6"><p role="status" className="text-sm text-slate-400">{error || 'Revisando tu conexión…'}</p>{error&&<button onClick={refresh} className="mt-3 text-teal-300">Volver a revisar</button>}</section>;
  const button='rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40';
  const card='rounded-2xl border border-slate-700 bg-slate-900 p-5';
  return <section className="px-5 py-4 space-y-4" aria-label="Configura tu bot">
    <div><h2 className="text-xl font-semibold">Tu asistente de WhatsApp</h2><p className="text-sm text-slate-400 mt-1">Conecta tu número, guarda tus precios y activa el bot.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    {state?.error && <p className="text-sm text-amber-300">{state.error}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
    <div className={card}><h3 className="font-semibold">1. Conecta WhatsApp</h3>
      <p className="text-sm text-slate-400 mt-2">{state?.connected?`Conectado: +${state.phone}`:'Se abrirá Zernio para conectar tu WhatsApp Business y volverás aquí al terminar.'}</p>
      {!state?.connected && <label className="block text-sm mt-3">Tu número está en
        <select aria-label="Dónde usas tu número" value={mode} onChange={e=>setMode(e.target.value)} className="block w-full mt-2 rounded-lg bg-slate-800 p-2">
          <option value="business_app">La aplicación WhatsApp Business de mi teléfono</option>
          <option value="api">Una API, como 360dialog</option>
        </select></label>}
      <div className="flex flex-wrap gap-2 mt-4"><button className={`${button} bg-teal-400 text-slate-950`} disabled={busy || !!state?.checks?.find(c=>c.key==='setup'&&!c.ok)}
        onClick={()=>run(async()=>{const r=await connectWhatsapp(userId,mode);window.location.assign(r.authUrl);})}>{state?.connected?'Cambiar o reconectar número':'Conectar WhatsApp'}</button>
        <button className={`${button} bg-slate-800`} disabled={busy} onClick={()=>run(async()=>setState(await resetWhatsapp(userId)))}>Revisar conexión</button></div>
    </div>
    <div className={card}><h3 className="font-semibold">2. Guarda tu perfil y precios</h3>
      <p className="text-sm text-slate-400 mt-2">El bot usará tu información y respetará el precio mínimo de cada paquete.</p>
      <div className="flex gap-2 mt-3"><button className={`${button} bg-slate-800`} onClick={onProfile}>Mi perfil</button><button className={`${button} bg-slate-800`} onClick={onPrices}>Mis precios</button></div></div>
    <div className={card}><h3 className="font-semibold mb-3">3. Prepara tus contactos</h3><AutomationSetup userId={userId} onSaved={refresh}/></div>
    <div className={card}><h3 className="font-semibold">4. {state?.botEnabled?'Bot activado':'Activa tu bot'}</h3>
      <ul className="my-4 space-y-2 text-sm">{(state?.checks || []).map(c=><li key={c.key} className={c.ok?'text-emerald-300':'text-slate-400'}>{c.ok?'✓':'○'} {c.label}</li>)}</ul>
      {state?.connected && state.checks?.some(c=>c.key==='templates'&&!c.ok) && <button disabled={busy} className={`${button} bg-slate-800 mb-3`} onClick={()=>run(async()=>setState(await prepareWhatsappTemplates(userId)))}>Preparar mensajes para aprobación</button>}
      <p className="text-sm text-slate-400 mb-4">Al activar, importará tus contactos y enviará como máximo un primer mensaje por minuto dentro del horario de envío. Seguirá incorporando los nuevos cada día. Las respuestas esperan cinco minutos para juntar los mensajes de la marca.</p>
      <p className="text-xs text-slate-400 mb-4">Los contactos con historial quedan para tu revisión. Si respondes desde tu teléfono, el bot se pausa en esa conversación.</p>
      <button disabled={busy || (!state?.botEnabled&&!state?.canActivate)} className={`${button} ${state?.botEnabled?'bg-amber-300':'bg-teal-400'} text-slate-950`}
        onClick={()=>run(async()=>setState(await setBotEnabled(userId,!state.botEnabled)))}>{busy?'Procesando…':state?.botEnabled?'Pausar bot':'Activar bot'}</button>
    </div>
    </div>
  </section>;
}
