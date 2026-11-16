"use server";
import {engineRequest} from '@/lib/engine';
export async function connectWhatsapp(userId,onboarding='business_app'){return engineRequest('/connect/'+userId,{method:'POST',body:{onboarding}});}
export async function whatsappStatus(userId){return engineRequest('/status/'+userId);}
export async function resetWhatsapp(userId){return engineRequest('/reset/'+userId,{method:'POST'});}
export async function setBotEnabled(userId,enabled){return engineRequest('/bot/'+userId,{method:'POST',body:{enabled}});}
export async function prepareWhatsappTemplates(userId){return engineRequest('/templates/'+userId,{method:'POST'});}
