# 10theGOAT · Checklist Beta pública

## Ya preparado en v0.11.0-beta.1
- Tres juegos públicos: Mayor o Menor, Adivina el jugador y Adivina el Escudo.
- SEO base, Open Graph 1200×630, favicon, sitemap y robots.
- Páginas 404/error.
- Páginas Beta, privacidad, cookies y aviso legal preliminar.
- Cabeceras básicas de seguridad.
- `npm run check:production` para evitar claves privadas en código público.
- API-Football no se usa desde el runtime público de los juegos.

## Antes de desplegar en Vercel
- [ ] `npm install`
- [ ] `npm run check:production`
- [ ] `npm run build`
- [ ] Commit/tag `v0.11.0-beta.1`
- [ ] Crear proyecto Vercel desde GitHub.
- [ ] Configurar `NEXT_PUBLIC_SUPABASE_URL` en Production/Preview.
- [ ] Configurar `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Production/Preview.
- [ ] NO configurar `SUPABASE_SECRET_KEY` ni `API_FOOTBALL_KEY` salvo que en el futuro exista un proceso server-side que realmente los necesite.

## Supabase
El esquema actual activa RLS en todas las tablas principales. Las políticas públicas de lectura existen para las tablas que usan los juegos. `player_external_ids`, `club_external_ids`, `competition_external_ids` y `sync_state` no tienen política pública de lectura en la migración inicial.

Antes de abrir la Beta:
- [ ] Hacer backup/export.
- [ ] Verificar desde una sesión anon que las tablas internas no se pueden leer.
- [ ] Confirmar que el cliente público solo puede hacer SELECT y no INSERT/UPDATE/DELETE.
- [ ] Comprobar que `players.game_name` está normalizado para todos los jugadores que entran en Wordle.

## Prueba en Preview de Vercel
- [ ] Home en 1920×1080.
- [ ] Home móvil (390×844 aprox.).
- [ ] Mayor o Menor: jugar hasta Game Over y comprobar puntos/récord.
- [ ] Adivina jugador: teclado físico + pantalla, pista, rendirse, seis fallos y victoria.
- [ ] Adivina Escudo: seis niveles de pixelado, sin filiales conocidos y resultado final legible.
- [ ] Recargar: comprobar persistencia local de puntuaciones.
- [ ] Navegar a una URL inexistente para comprobar 404.
- [ ] Probar `/sitemap.xml` y `/robots.txt`.
- [ ] Comprobar tarjeta social con `/brand/10thegoat-og-1200x630.png`.

## Bloqueador legal antes de abrir el dominio públicamente
Completar el Aviso Legal con la identificación y canal de contacto real del titular. Las páginas incluidas son una base de Beta, no sustituyen una revisión legal cuando haya monetización, analítica, publicidad o cuentas de usuario.

## Dominio
Después de validar la URL temporal de Vercel:
- [ ] Añadir `10thegoat.com` a Vercel.
- [ ] Elegir dominio canónico (`10thegoat.com` recomendado).
- [ ] Redirigir `www.10thegoat.com` → `10thegoat.com`.
- [ ] Confirmar HTTPS.
- [ ] Volver a probar sitemap, canonical/OG y juegos ya desde el dominio real.
