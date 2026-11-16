"use server";
import {engineRequest} from '@/lib/engine';
async function request(path,options){
  try{return await engineRequest(path,options);}
  catch(error){return {ok:false,error:error.message||'No se pudo completar la operación. Vuelve a revisar el estado.'};}
}
export async function connectWhatsapp(userId,onboarding='business_app'){return request('/connect/'+userId,{method:'POST',body:{onboarding}});}
export async function whatsappStatus(userId){return request('/status/'+userId);}
export async function resetWhatsapp(userId){return request('/reset/'+userId,{method:'POST'});}
export async function setBotEnabled(userId,enabled){return request('/bot/'+userId,{method:'POST',body:{enabled}});}
export async function prepareWhatsappTemplates(userId){return request('/templates/'+userId,{method:'POST'});}
export async function automationStatus(userId){return request('/automation/'+userId);}
export async function saveAutomation(userId,lookbackDays,consent){return request('/automation/'+userId,{method:'PUT',body:{lookbackDays,consent}});}
export async function syncContacts(userId){return request('/automation/'+userId+'/sync',{method:'POST'});}
export async function decideContact(userId,phone,action){return request('/automation/'+userId+'/decide',{method:'POST',body:{phone,action}});}
