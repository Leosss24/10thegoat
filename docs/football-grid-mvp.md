# Football Grid · MVP

Base: `46bbd904ec0909428f5cbe4dd43aabda13d18882` (referencia local `origin/main` al iniciar). Solo se modifica la integración necesaria en navegación, catálogo, sitemap y panel de usuario.

## Reglas acordadas

- 4 × 4 casillas, 16 futbolistas distintos. Autocompletado por nombre y alias, ignorando tildes.
- Fácil: nacionalidad × club o nacionalidad × posición; 120 segundos; +100 al completar, 0 si expira, −20 al rendirse.
- Difícil: club × club; 90 segundos; +200 al completar, 0 si expira, −50 al rendirse.
- Intentos ilimitados durante el tiempo. Sin puntos parciales ni penalización por respuestas incorrectas. Cada saldo de modo tiene suelo cero.
- Tres partidas diarias por cuenta y dificultad. Ganar o agotar el tiempo consume una; rendirse antes del vencimiento no consume el límite.
- Día de inicio de la partida, zona `Europe/Madrid`, reinicio a medianoche. Cerrar la pestaña o cambiar de idioma no pausa el tiempo. Una ronda que cruza medianoche se imputa al día en que comenzó.
- Nacionalidad del perfil, no selección representada. Para un club se exige evidencia de al menos una aparición en una competición oficial del primer equipo. No se aceptan fichajes, relaciones de plantilla o amistosos como prueba.
- Posiciones disponibles en la fuente: portero, defensa, centrocampista y delantero.
- Se puede vaciar una casilla resuelta para cambiar su jugador y evitar quedarse sin solución por una elección válida compartida con otro cruce. Nunca puede repetirse un jugador simultáneamente en dos casillas.

Las reglas y los importes se muestran antes de empezar y durante el juego en ES/EN/FR. Las dos variantes fáciles se eligen con la misma probabilidad. Los tableros se seleccionan aleatoriamente de un banco comprobado mediante emparejamiento bipartito: cada uno admite 16 respuestas distintas.

## Datos y SQL de API-Football

Se consultó Supabase en modo lectura usando la configuración existente del proyecto principal. La selección final sustituye la propuesta inicial de las cinco grandes ligas: **leyendas más jugadores de las plantillas actuales de los 26 clubes europeos de Premium Internacional y Élite Internacional del modo Carrera**. Las plantillas se consultaron en API-Football el 8 de septiembre de 2026; dependen de la actualización del proveedor.

En fácil, los ejes de club se limitan a esos 26 europeos. En difícil, se admiten los 45 clubes de ambas categorías, incluidos los no europeos, cuando las trayectorias verificadas permiten un tablero resoluble. Eso no incorpora a las plantillas actuales de los clubes no europeos. `data/football-grid/pool.json` conserva las listas y la procedencia de las plantillas; `lib/football-grid/pool.ts` define la política.

API-Football aporta plantillas, perfiles y estadísticas de 2026/2025, además de temporadas históricas concretas. Referencia: [documentación v3](https://www.api-football.com/documentation-v3). Las apariciones oficiales verificadas documentalmente que faltan en la API se conservan con sus fuentes en `data/football-grid/verified-appearances.json`; no se inventan totales de temporada.

Resultado preparado:

- **789 futbolistas**, incluidas **44 leyendas**: las 43 marcadas en Supabase y Messi, añadido solo para este juego según lo acordado.
- 689 tienen evidencia oficial de al menos un club permitido. Los otros 100 pueden responder nacionalidad × posición.
- **300 tableros**, 100 de cada variante. Siete tableros difíciles incluyen Palmeiras. River tiene tres jugadores elegibles con evidencia y todavía no aparece en un tablero 4×4; Julián Álvarez sí conserva sus cruces con River, Atlético y City. Messi conserva Barcelona y PSG.
- 823 jugadores distintos en las plantillas consultadas. Se preparan 356 altas canónicas y 3.067 filas estadísticas para insertar o completar. 78 candidatos carecen de metadatos necesarios y quedan excluidos; el informe de extracción enumera los casos.

Para jugadores existentes, el SQL rellena nacionalidad, nombre completo, foto y posición ausentes; conserva los nombres de juego y la curación existente. También actualiza la pertenencia actual de los miembros consultados y crea los jugadores nuevos con sus equivalencias API. Las apariciones ya informadas no se sobrescriben. Los IDs nuevos se reservan en la vista previa: si entretanto otro proceso ocupa un ID con otra identidad, el SQL aborta íntegramente y hay que reexportar/regenerar los dos seeds, sin saltarse la protección. Se bloquean las tablas durante esa comprobación y se avanza la secuencia sin reducirla. La importación transaccional se ha probado dos veces sin duplicados. El SQL **todavía no se ha aplicado a Supabase**.

La cobertura de trayectorias sigue siendo parcial. Los cruces de clubes solo utilizan evidencia disponible de partidos oficiales, con una lista explícita de competiciones sénior reconocidas, porque muchas competiciones del importador están clasificadas como `other`. No se interpreta esa categoría como prueba de oficialidad. Una respuesta ausente de las trayectorias del catálogo no demuestra que el futbolista nunca jugara en ese club.

El juego carga `data/football-grid/catalog.json`; Supabase guarda la misma versión como JSONB para validar respuestas y mantener partidas existentes. No consulta API-Football durante las partidas. Las fotos y escudos siguen siendo URLs de imagen, no imágenes incrustadas en el JSON. La excepción de Messi no modifica el campo global `is_legend` ni la selección de otros juegos.

## Activación en Supabase

Hay tres archivos revisables. Ejecutarlos como propietario de la base, en este orden, antes de desplegar el juego:

1. `supabase/migrations/20260908_014_football_grid.sql`: tablas, políticas y RPC del juego. Requiere las migraciones previas, incluida la 012 de estadísticas.
2. `supabase/seeds/football_grid_data.sql`: datos recuperados de API-Football.
3. `supabase/seeds/football_grid_catalog.sql`: catálogo de jugadores y tableros, con versión inmutable.

La migración se aplica una vez; los dos seeds pueden repetirse. La conexión REST disponible permite consultar datos, pero no ejecutar DDL/SQL arbitrario: falta aplicar estos archivos desde el SQL Editor de Supabase o una conexión PostgreSQL autorizada. No se ha probado OAuth ni una partida contra la base remota con esta migración instalada.

Tras aplicarlos, verificar una cuenta real: iniciar una partida, cambiar ES → EN → FR, recargar, rendirse, completar un grid y comprobar estadísticas y logros en Mi zona. Desplegar la aplicación solo cuando la migración y el catálogo estén disponibles.

## Persistencia y puntuación

Se exige iniciar sesión. `football_grid_play` utiliza `auth.uid()`, reloj de PostgreSQL y un bloqueo transaccional por usuario. El servidor guarda el tablero, respuestas, fecha de inicio, vencimiento, dificultad, resultado y versión del catálogo. Solo permite una ronda activa por usuario y dificultad; las solicitudes repetidas de inicio recuperan la misma ronda.

Las operaciones de respuesta, rendición, vencimiento y puntuación se liquidan una vez. Tras el vencimiento, responder o rendirse registra un timeout. RLS impide escribir directamente en las rondas. El cliente conserva únicamente el modo seleccionado en `sessionStorage`; puede reconstruir la partida desde la cuenta aunque se borre el almacenamiento local.

Las estadísticas se guardan en `user_game_stats`, con claves `football-grid-easy` y `football-grid-hard`, y suman al total del perfil. La sincronización local antigua omite estas claves tanto en cliente como en SQL, evitando que un saldo local desactualizado reponga puntos perdidos al rendirse. El contrato de sincronización del resto de juegos se conserva.

Logros propios, visibles en el juego y el perfil: primer grid fácil, primer grid difícil, completar ambos modos y diez grids completos. Se calculan desde las victorias persistidas. No se añade una clasificación pública.

## Regeneración

```powershell
node --env-file=.env.local scripts/export-football-grid.mjs
node --env-file=.env.local --experimental-strip-types scripts/prepare-football-grid-pool.mjs --season=2026 --max-requests=300
node --experimental-strip-types scripts/build-football-grid.mjs --snapshot=tmp/football-grid-enriched.json
node --experimental-strip-types scripts/seed-football-grid.mjs
```

El exportador solo lee Supabase; el enriquecedor solo lee API-Football y produce SQL. Ninguno publica ni importa automáticamente. `--env=RUTA` permite cargar configuración existente sin copiar claves. Las respuestas de API se conservan en `tmp/grid-api-cache`; se reutilizan al reanudar. Para refrescar una temporada se debe retirar explícitamente su caché. No hay claves en los artefactos generados.

Los IDs de jugadores y clubes permanecen canónicos. Los criterios de país usan nombres de país estables, de modo que las secuencias de nuevos países en PostgreSQL no afectan al catálogo. Conservar versiones antiguas de `football_grid_catalogs` permite terminar partidas previas después de actualizar el banco.

## Verificación

- `npm test`: 46 pruebas, incluidas ocho de catálogo, selección de jugadores, ejemplos acordados, emparejamiento, búsqueda, reglas y traducciones.
- `node --experimental-strip-types scripts/test-football-grid-db.mjs`: 23 comprobaciones sobre PostgreSQL embebido, ejecutando la migración y el seed reales; incluye RLS, aislamiento, inicio concurrente, reloj, límites, recompensas, penalizaciones, idempotencia y compatibilidad con estadísticas existentes.
- `node scripts/test-football-grid-data.mjs`: ejecuta el SQL de datos dos veces sobre la instantánea local y compara con la vista previa. Preserva los campos existentes y evita duplicados.
- Build de producción correcto con las rutas ES/EN/FR y Google Fonts preexistente.
- `scripts/test-football-grid-ui.mjs`: navegador real conectado a los RPC SQL en PostgreSQL local mediante interceptación HTTP. Cubre escritorio, 390 px y 320 px, ES/EN/FR, teclado, respuestas incorrectas, victoria, rendición, vencimiento, cuota, recargas, dos pestañas, recuperación de red y acceso sin sesión. Comprueba que fotos y escudos cargan.

Para PostgreSQL de pruebas: `npm install --prefix tmp/grid-test --no-audit --no-fund @electric-sql/pglite`. Para la prueba de navegador, arrancar la aplicación en el puerto 3108 con configuración pública de Supabase y ejecutar el script con `.env.local`. `GRID_PLAYWRIGHT_MODULE` permite señalar un Playwright instalado; `GRID_BROWSER_CHANNEL` usa `msedge` por defecto y `GRID_BASE_URL` cambia la URL local. Las capturas están en `tmp/grid-*.png`.
