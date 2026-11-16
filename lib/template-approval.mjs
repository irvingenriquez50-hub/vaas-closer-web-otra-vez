export function approvalBadge(status) {
  if(status==='APPROVED') return {label:'Approved',symbol:'✓',color:'border-emerald-700 bg-emerald-950 text-emerald-300'};
  if(['PENDING','IN_APPEAL'].includes(status)) return {label:'Pending approval',symbol:'◷',color:'border-amber-700 bg-amber-950 text-amber-200'};
  if(status==='UNKNOWN') return {label:'Unable to verify',symbol:'?',color:'border-slate-600 bg-slate-800 text-slate-200'};
  const labels={REJECTED:'Rejected',PAUSED:'Paused by Meta',DISABLED:'Disabled by Meta',PENDING_DELETION:'Pending deletion'};
  return {label:labels[status] || 'Not yet approved',symbol:'○',color:'border-red-800 bg-red-950 text-red-200'};
}

export function openingPreview(fields,tiers) {
  const price=n=>tiers.find(t=>t.videos===n)?.anchor ?? '___';
  return `Hi! I have generated $${fields.gmvTotal || '___'} in GMV for the ${fields.market || '___'} audience. I am ${fields.shortName || '___'} from the VAAS community. My packages are: 1 video for $${price(1)}, 5 for $${price(5)}, or 10 for $${price(10)}. Last 30 days GMV: $${fields.gmv30d || '___'}. TikTok: @${fields.tiktokHandle?.replace(/^@/,'') || '___'}. Would you like to discuss a paid collaboration? Reply STOP to opt out.`;
}
