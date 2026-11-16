'use client';
import * as actions from './whatsapp-actions';
// Expected failures cross the server-action boundary as data so Next.js keeps
// the useful explanation instead of replacing it with a production digest.
const call=action=>async(...args)=>{
  const result=await action(...args);
  if(!result?.ok) throw new Error(result?.error||'No se pudo completar la operación.');
  return result;
};
export const connectWhatsapp=call(actions.connectWhatsapp);
export const whatsappStatus=call(actions.whatsappStatus);
export const resetWhatsapp=call(actions.resetWhatsapp);
export const setBotEnabled=call(actions.setBotEnabled);
export const prepareWhatsappTemplates=call(actions.prepareWhatsappTemplates);
export const automationStatus=call(actions.automationStatus);
export const saveAutomation=call(actions.saveAutomation);
export const syncContacts=call(actions.syncContacts);
export const decideContact=call(actions.decideContact);
