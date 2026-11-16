import {NextResponse} from 'next/server';
import {engineRequest} from '@/lib/engine';

export async function GET(request){
  const url=new URL(request.url);
  const destination=new URL('/dashboard',url.origin);
  destination.searchParams.set('tab','whatsapp');
  try{
    if(url.searchParams.has('whatsapp_error')) throw new Error('La conexión no se completó. Puedes intentarlo otra vez.');
    const result=await engineRequest('/connection/complete',{method:'POST',body:{state:url.searchParams.get('state'),accountId:url.searchParams.get('accountId'),profileId:url.searchParams.get('profileId')}});
    destination.searchParams.set('as',result.userId);
    destination.searchParams.set('connection','success');
  }catch{destination.searchParams.set('connection','retry');}
  const response=NextResponse.redirect(destination);
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('Cache-Control','no-store');
  return response;
}
