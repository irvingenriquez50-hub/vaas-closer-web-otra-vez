import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function engineRequest(path, {method='GET',body}={}) {
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error('Inicia sesión para continuar.');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token) throw new Error('Tu sesión expiró.');
  if(!process.env.BOT_ENGINE_URL) throw new Error('El administrador debe configurar la conexión del sistema.');
  try {
    const health=await fetch(`${process.env.BOT_ENGINE_URL}/health`,{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(r=>r.json());
    if(health.provider!=='zernio') throw new Error('La actualización del motor de Zernio está pendiente.');
    const res=await fetch(`${process.env.BOT_ENGINE_URL}${path}`,{method,cache:'no-store',
      headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
    const data=await res.json().catch(()=>null);
    if(!res.ok || !data?.ok) throw new Error(data?.error || 'No se pudo completar la operación.');
    return data;
  } catch(error) {
    if(error.name==='TimeoutError' || error instanceof TypeError) throw new Error('El sistema tardó en responder. Vuelve a revisar el estado.');
    throw error;
  }
}
