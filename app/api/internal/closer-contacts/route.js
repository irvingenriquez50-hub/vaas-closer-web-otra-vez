import {timingSafeEqual} from 'node:crypto';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request) {
 const expected=process.env.CLOSER_SYNC_SECRET,provided=request.headers.get('x-closer-sync')||'';
 if(!expected || Buffer.byteLength(expected)!==Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))
  return Response.json({ok:false},{status:401});
 const days=Number(new URL(request.url).searchParams.get('days'));
 if(days!==30) return Response.json({ok:false},{status:400});
 if(!process.env.DISCORD_BOT_URL || !process.env.BOT_IMPORT_SECRET || !process.env.DISCORD_CHANNEL_ID)
  return Response.json({ok:false},{status:503});
 try {
  const url=new URL('/contacts',process.env.DISCORD_BOT_URL);
  url.searchParams.set('channelId',process.env.DISCORD_CHANNEL_ID);
  const requestedSince=Date.parse(new URL(request.url).searchParams.get('since'));
  const earliest=Date.now()-days*86400000;
  url.searchParams.set('since',new Date(Number.isFinite(requestedSince)?Math.min(Date.now(),Math.max(earliest,requestedSince)):earliest).toISOString());
  url.searchParams.set('until',new Date().toISOString());
  const res=await fetch(url,{headers:{'x-import-secret':process.env.BOT_IMPORT_SECRET},cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!res.ok) throw new Error('source');
  const data=await res.json();
  if(!data.ok || !Array.isArray(data.contacts) || data.contacts.length>20000) throw new Error('source');
  return Response.json({ok:true,contacts:data.contacts.map(c=>({phone:c.phone,product:c.product,videos_text:c.videos_text,price_text:c.price_text,
   created_at:c.created_at,discord_message_key:c.discord_message_key}))},{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({ok:false},{status:503});}
}
