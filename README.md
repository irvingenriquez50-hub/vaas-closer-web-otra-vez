# VAAS Closer Bot — Web

Panel privado (separado del Retainer Tracker) donde cada miembro aprobado configura su escrito,
sus precios, y su cola de contactos. Login con Google, acceso solo para quien Irving apruebe
manualmente, 30 días de acceso que se renuevan a mano.

## Deploy en Vercel

1. Sube esta carpeta a un repo nuevo de GitHub (ej. `vaas-closer-web`).
2. En vercel.com → New Project → Import ese repo.
3. En "Environment Variables" agrega las de `.env.example` con tus valores reales
   (Project Settings → API en tu proyecto de Supabase para la URL y la anon key).
4. Deploy.
5. En Google Cloud Console, en tu OAuth Client existente, agrega como Authorized redirect URI:
   `https://<tu-proyecto>.supabase.co/auth/v1/callback`
6. En Supabase → Authentication → Providers → Google: actívalo y pega tu Client ID y Client Secret.
7. En Supabase → Authentication → URL Configuration: pon tu dominio de Vercel como Site URL.
