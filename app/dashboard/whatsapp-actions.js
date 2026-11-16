"use server";
import {engineRequest} from '@/lib/engine';
export async function connectWhatsapp(userId,onboarding='business_app'){return engineRequest('/connect/'+userId,{method:'POST',body:{onboarding}});}
export async function whatsappStatus(userId){return engineRequest('/status/'+userId);}
export async function resetWhatsapp(userId){return engineRequest('/reset/'+userId,{method:'POST'});}
export async function setBotEnabled(userId,enabled){return engineRequest('/bot/'+userId,{method:'POST',body:{enabled}});}
export async function prepareWhatsappTemplates(userId){return engineRequest('/templates/'+userId,{method:'POST'});}
export async function automationStatus(userId){return engineRequest('/automation/'+userId);}
export async function saveAutomation(userId,lookbackDays,consent){return engineRequest('/automation/'+userId,{method:'PUT',body:{lookbackDays,consent}});}
export async function syncContacts(userId){return engineRequest('/automation/'+userId+'/sync',{method:'POST'});}
export async function decideContact(userId,phone,action){return engineRequest('/automation/'+userId+'/decide',{method:'POST',body:{phone,action}});}
