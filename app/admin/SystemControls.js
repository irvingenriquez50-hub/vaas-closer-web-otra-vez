'use client';
import {useState,useEffect,useCallback} from 'react';
import {getSystemOverview,toggleSystemSends} from './actions';

export default function SystemControls({onUpdate}){
  const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{try{const next=await getSystemOverview();setState(next);onUpdate?.(next);setError('');}catch(e){setError(e.message);}},[onUpdate]);
  useEffect(()=>{refresh();const t=setInterval(refresh,30000);return()=>clearInterval(t);},[refresh]);
  return <section className="mx-5 my-4 p-4 rounded-xl border border-slate-700 bg-slate-900">
    <h2 className="font-semibold">Control del sistema · Zernio</h2>
    {error&&<p role="alert" className="text-sm text-red-300 mt-2">{error}</p>}
    {state&&<><p className="text-sm text-slate-400 mt-2">{state.globalEnabled?'Envíos habilitados. Cada persona activa su propio bot.':'Todos los envíos están pausados.'}</p>
      {!!state.missing?.length&&<p className="text-sm text-amber-300 mt-2">Configuración pendiente en el servidor: {state.missing.join(', ')}.</p>}
      {!!(state.failedEvents||state.uncertainSends)&&<p className="text-sm text-amber-300 mt-2">Requieren revisión: {state.failedEvents} eventos y {state.uncertainSends} envíos sin confirmar.</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">{[['queued','Por iniciar'],['review','Por revisar'],['active','En proceso'],['collaborated','Colaboraciones']].map(([key,label])=><div key={key} className="rounded-xl bg-slate-800 p-3"><p className="text-xl font-semibold">{state.automationCounts?.[key]??0}</p><p className="text-xs text-slate-400">{label}</p></div>)}</div>
      <button disabled={busy||(!state.globalEnabled&&!!state.missing?.length)} className="mt-3 rounded-lg bg-teal-400 text-slate-950 px-3 py-2 text-sm font-semibold disabled:opacity-40"
        onClick={async()=>{setBusy(true);try{await toggleSystemSends(!state.globalEnabled);await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}}>{state.globalEnabled?'Pausar todos los envíos':'Habilitar envíos del sistema'}</button>
      <div className="space-y-2 mt-4">{state.channels?.map(c=><div key={c.user_id} className="text-sm flex flex-wrap gap-2"><span>{c.phone_number?`+${c.phone_number}`:'Conexión pendiente'}</span><span className="text-slate-400">· {c.connected?'Conectado':'Revisar conexión'} · {c.bot_enabled?'Bot activado':'Bot pausado'}</span><a className="text-teal-300" href={`/dashboard?as=${c.user_id}&tab=whatsapp`}>Ver como miembro →</a>{c.last_error&&<span className="w-full text-xs text-amber-300">{c.last_error}</span>}</div>)}</div>
    </>}
  </section>;
}
