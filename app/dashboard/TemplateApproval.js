'use client';
import {useEffect,useState} from 'react';
import {whatsappStatus} from './whatsapp-client';
import {approvalBadge} from '@/lib/template-approval.mjs';

export function TemplateApproval({state,error,lang='es',unsaved=false}) {
  const en=lang==='en';
  const missingProfile=state?.checks?.find(c=>c.key==='profile'&&!c.ok);
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-4" aria-label={en?'WhatsApp approval':'Aprobación de WhatsApp'}>
    <h3 className="text-sm font-semibold">{en?'WhatsApp message approval':'Aprobación de mensajes de WhatsApp'}</h3>
    {!state&&!error?<p role="status" className="mt-2 text-sm text-slate-400">{en?'Checking approval…':'Consultando aprobación…'}</p>:
      <div className="mt-3 flex flex-wrap gap-3" role="status" aria-live="polite">{['opening','followup'].map(key=>{
        const verdict=error?{status:'UNKNOWN'}:state?.approval?.[key] || {status:'UNKNOWN'};
        const badge=approvalBadge(verdict.status);
        return <div key={key} className="text-xs"><p className="mb-1 text-slate-400">{key==='opening'?(en?'First message':'Primer mensaje'):(en?'Follow-up':'Seguimiento')}</p>
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${badge.color}`}>{badge.symbol} {badge.label}</span>
          {verdict.reason&&<p className="mt-2 max-w-md text-red-200">{verdict.reason}</p>}</div>;
      })}</div>}
    {error?<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>:
      <p className="mt-3 text-xs text-slate-400">{!state?'':!state.connected?
        (en?'Connect WhatsApp and save your script and prices to request approval.':'Conecta WhatsApp y guarda Tu escrito y tus precios para solicitar la aprobación.'):
        missingProfile?(en?'Complete and save your script and prices. The approval request is sent automatically.':'Completa y guarda Tu escrito y tus precios. La solicitud se envía automáticamente.'):
        (en?'Updates automatically from Meta. Saving your details does not activate the bot or send messages to contacts.':'Se actualiza automáticamente con la respuesta de Meta. Guardar tus datos no activa el bot ni envía mensajes a contactos.')}</p>}
    {unsaved&&<p className="mt-2 text-xs text-amber-200">{en?'You have unsaved changes. This status belongs to the saved template.':'Tienes cambios sin guardar. Este estado corresponde a la plantilla guardada.'}</p>}
  </section>;
}

export default function ScriptApproval({userId,revision,lang,unsaved}) {
  const [state,setState]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false,inFlight=false;
    const refresh=async()=>{
      if(inFlight)return;inFlight=true;
      try{const next=await whatsappStatus(userId);if(!cancelled){setState(next);setError('');}}
      catch(e){if(!cancelled)setError(e.message);}finally{inFlight=false;}
    };
    refresh();const timer=setInterval(refresh,30000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[userId,revision]);
  return <TemplateApproval state={state} error={error} lang={lang} unsaved={unsaved}/>;
}
