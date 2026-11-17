import {openingParams,renderOpening} from './whatsapp-templates.mjs';

export function approvalBadge(status) {
  if(status==='APPROVED') return {label:'Approved',symbol:'✓',color:'border-emerald-700 bg-emerald-950 text-emerald-300'};
  if(['PENDING','IN_APPEAL'].includes(status)) return {label:'Pending approval',symbol:'◷',color:'border-amber-700 bg-amber-950 text-amber-200'};
  if(status==='UNKNOWN') return {label:'Unable to verify',symbol:'?',color:'border-slate-600 bg-slate-800 text-slate-200'};
  const labels={REJECTED:'Rejected',PAUSED:'Paused by Meta',DISABLED:'Disabled by Meta',PENDING_DELETION:'Pending deletion',CONTENT_MISMATCH:'Content mismatch'};
  return {label:labels[status] || 'Not yet approved',symbol:'○',color:'border-red-800 bg-red-950 text-red-200'};
}

export function openingPreview(fields,tiers) {
  return renderOpening(openingParams(fields,tiers));
}
