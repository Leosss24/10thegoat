# Badges coleccionables

## Catálogo y reglas

32 badges: tres por cada uno de los nueve juegos y cinco retos de Trivia. El catálogo trilingüe y los umbrales están en `lib/badges/catalog.json`. Los escudos son SVG, con la paleta del juego y una misma base. No dependen de imágenes generadas ni de una petición a la BBDD para dibujarse.

- Progreso de constancia por IDs distintos: jugadores, carreras terminadas, clubes, tableros y rondas. Se conserva hasta alcanzar el umbral.
- Mayor o menor cuenta todos los aciertos, incluso los que no mejoran la puntuación personal.
- Football Grid usa el tablero actual de **16/16**. El servidor valida los resultados y guarda respuestas incorrectas o jugadores duplicados. Las partidas antiguas sin registro de errores no conceden «Cuadrícula perfecta» retroactivamente.
- En Escudos, cada intento fallido revela más imagen: «Sin dudas» exige diez escudos consecutivos acertados al primer intento. No hay un botón de pistas en este juego.
- En Historia, cada comprobación fallida rompe la racha. Recargar mantiene esa racha en la sesión del navegador.
- Los modos de Trivia tienen premios separados. El cronómetro debe terminar antes de mostrar el aviso para no perjudicar la partida.
- Los retos conceden el badge al obtener 20/25 y lo mejoran a Pleno con 25/25. Repetir está permitido; el premio nunca retrocede. Solo Mundiales está disponible inicialmente. Las fechas de los demás se toman del calendario existente.
- Los logros de los juegos locales empiezan a contabilizarse al instalar esta versión. No se infieren jugadores o tableros distintos a partir de estadísticas agregadas antiguas. Carrera puede reconocer títulos y carreras completas conservadas al cargarlas. Grid recupera sus victorias de los registros del servidor.

## Mi Zona

La colección compacta sustituye visualmente al panel antiguo de logros. Los 32 badges se muestran en pequeño, incluidos los pendientes en gris. Pulsar cualquiera abre sus condiciones, progreso y disponibilidad en un diálogo accesible. El código y los cálculos anteriores se conservan detrás de `SHOW_LEGACY_ACHIEVEMENTS = false` en `UserDashboard.tsx`; no se borran datos ni tablas.

## Persistencia y cuentas

`BadgeProvider` sigue la autenticación de Supabase. Cada cuenta usa una caché y una cola independientes (`10tg-badges-v1:<user-id>`). Al cambiar de cuenta se invalidan las respuestas en curso; los premios de un invitado no se transfieren automáticamente a otra persona.

Los invitados pueden probar la colección durante la sesión de esa pestaña. La interfaz pide iniciar sesión **antes de jugar** para conservar los siguientes premios en la cuenta. Los resultados offline de una cuenta se reintentan al recuperar conexión, enfocar la página o al cabo de un minuto. Los errores de guardado se muestran; nunca se afirma que la cuenta esté sincronizada si falla la RPC.

Los hechos se fusionan por máximo o por contenido único, nunca sumando instantáneas. Por ello, una recarga, un reenvío de red o dos dispositivos no duplican progreso. Los avisos se agrupan y solo se muestran por una nueva concesión o mejora a Pleno. Un diálogo nativo conserva foco y permite Escape.

## Base de datos e instalación

Aplicar **después de la migración 015**:

`supabase/migrations/20260916_016_collectible_badges.sql`

La migración es transaccional y se puede ejecutar de nuevo. Crea el catálogo SQL, hechos por usuario y concesiones permanentes; amplía `football_grid_rounds` con el contador de errores y actualiza `football_grid_play` conservando las reglas existentes. No borra estadísticas ni partidas.

La función `sync_own_badges(p_facts jsonb)` deriva la identidad exclusivamente de `auth.uid()`, limita y valida lotes, serializa escrituras por usuario y conserva las fechas originales. Las tablas de progreso y premios tienen RLS; el navegador no puede insertar, actualizar ni borrar premios directamente. Las claves de servicio no se usan en el cliente.

**Límite de confianza:** los juegos que ya se ejecutan en el navegador comunican hechos validados en formato y límites, pero no son un sistema antitrampas: un cliente manipulado puede inventar resultados locales. Grid usa sus partidas autoritativas de servidor y rechaza hechos de Grid enviados por el cliente. Hacer autoritativos los otros ocho juegos requeriría trasladar sus reglas y sesiones al servidor.

El usuario confirmó la aplicación de la migración en Supabase. Se verificó después que la RPC `sync_own_badges` y las tablas `user_badges` y `user_badge_facts` existen y rechazan el acceso anónimo con `42501` (antes la RPC devolvía `PGRST202`). La concesión, sincronización y recuperación autenticadas se probaron con la migración real en PostgreSQL aislado (PGlite); no se ha realizado una partida de prueba con una cuenta real en el servicio remoto.

## Pruebas

- `npm test`: incluye los umbrales de los 32 badges, duplicados, progreso máximo, fusión y Pleno.
- `node scripts/test-badges-client.mjs`: cola offline, reintento, cambio de cuenta, respuestas antiguas, invitado y rachas. Transpila el cliente real a un directorio temporal y sustituye únicamente el transporte de Supabase.
- `npm install --prefix tmp/grid-test --no-save --package-lock=false @electric-sql/pglite`
- `node --experimental-strip-types scripts/test-badges-db.mjs`: ejecuta la migración real, permisos/RLS, umbrales, idempotencia, Pleno y errores de Grid, sin escribir en el servicio remoto.
- `node scripts/test-badges-browser.mjs`: servidor de producción local en 3211 (configurable con `BADGES_TEST_URL`), Edge, colección, móvil/escritorio, idiomas, seis juegos, avisos, Pleno y recargas.
- `node --env-file=.env.local scripts/test-badges-account-browser.mjs`: autenticación simulada, transporte Supabase interceptado y migración SQL real en PGlite. Completa también Adivina el jugador, Mayor o menor, Carrera y Grid 16/16. Comprueba guardado tras jugar, recuperación en otro dispositivo, cierre de sesión y aislamiento. No escribe en Supabase remoto.
- `npm run build`: compilación y tipos de producción.

Las capturas de las pruebas se guardan en `tmp/badges/` (ignorado por Git).
